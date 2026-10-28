#!/usr/bin/env python3
"""Build and HubSign the「Apple Pay 記帳」shortcut.

After an Apple Pay tap, append one line to the shared note
「家庭開支 Apple Pay」:

    短日期 短時間｜商戶｜金額

Merchant is preferred. If that field is empty, Name is used instead.
iOS strips Wallet triggers from a shared shortcut, so the install page
tells the user to attach「當我輕點錢包卡…」once on the phone.

HubSign: https://hubsign.routinehub.services/sign (signed file starts with AEA1).
"""

from __future__ import annotations

import json
import plistlib
import re
import sys
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

OUT_DIR = Path(__file__).resolve().parent
NAME = "Apple Pay 記帳"
NOTE_NAME = "家庭開支 Apple Pay"
VERSION = "v1.0.0-apple-pay-log"
SIGNED_FILENAME = "ApplePay記帳.shortcut"
UNSIGNED_FILENAME = "ApplePay記帳.unsigned.plist"
HUBSIGN_URL = "https://hubsign.routinehub.services/sign"
PIPE = "\uff5c"
FLAG = "有"

COMMENT = (
    "用 Apple Pay 後自動寫入備忘錄「家庭開支 Apple Pay」。\n"
    "安裝後仲要喺捷徑加 Wallet 觸發（iOS 27 分享通常帶唔到觸發）。\n"
    "一行格式：短日期 短時間｜商戶｜金額。商戶空白就改用名稱。\n"
    "搵唔到備忘錄就會彈提示。冇商戶、冇名稱、又冇金額就唔寫，避免空行。"
)

NO_NOTE_LEAD = "請先新增一張備忘錄，名稱要包含「"
NO_NOTE_TAIL = (
    "」。\n\n"
    "要同 Andy 共同編輯、可更改，唔好上鎖。"
    "兩個人都要喺「備忘錄」睇到呢張。"
)
NO_TX_TITLE = "未有付款資料"
NO_TX_MESSAGE = (
    "呢個捷徑要由錢包輕點觸發，唔係喺捷徑 App 入面撳一下就有數。\n\n"
    "請去「捷徑」→「自動化」→ 加「當我輕點錢包卡…」，"
    "揀信用卡，揀「立即執行」，再用 Apple Pay 付一筆小額試。"
)
NO_NOTE_TITLE = "搵唔到備忘錄"
NOTIFY_TITLE = "已記低"


def uid() -> str:
    return str(uuid.uuid4()).upper()


def utf16_len(text: str) -> int:
    return len(text.encode("utf-16-le")) // 2


def var_attachment(output_name: str, output_uuid: str):
    return {
        "Value": {
            "OutputName": output_name,
            "OutputUUID": output_uuid,
            "Type": "ActionOutput",
        },
        "WFSerializationType": "WFTextTokenAttachment",
    }


def if_input_from(attachment: dict):
    return {"Type": "Variable", "Variable": attachment}


def if_input_named(name: str):
    return {
        "Type": "Variable",
        "Variable": {
            "Value": {"Type": "Variable", "VariableName": name},
            "WFSerializationType": "WFTextTokenAttachment",
        },
    }


def token_string(parts: list):
    text = ""
    attachments = {}
    for part in parts:
        if isinstance(part, str):
            text += part
            continue
        start = utf16_len(text)
        text += "\ufffc"
        attachments[f"{{{start}, 1}}"] = part
    return {
        "Value": {"attachmentsByRange": attachments, "string": text},
        "WFSerializationType": "WFTextTokenString",
    }


def named_var(name: str):
    return {"Type": "Variable", "VariableName": name}


def action_output(output_name: str, output_uuid: str):
    return {
        "Type": "ActionOutput",
        "OutputName": output_name,
        "OutputUUID": output_uuid,
    }


def shortcut_input_property(property_name: str):
    # Text fields coerce the property to a string. Amount is a currency
    # value; coercing it here is what makes「HK$12.00」land in the note
    # instead of a number action that can fail the automation.
    return {
        "Type": "ExtensionInput",
        "Aggrandizements": [
            {
                "Type": "WFPropertyVariableAggrandizement",
                "PropertyName": property_name,
            },
            {
                "Type": "WFCoercionVariableAggrandizement",
                "CoercionItemClass": "WFStringContentItem",
            },
        ],
    }


def current_date_short():
    return {
        "Type": "CurrentDate",
        "Aggrandizements": [
            {
                "Type": "WFDateFormatVariableAggrandizement",
                "WFDateFormatStyle": "Short",
                "WFTimeFormatStyle": "Short",
                "WFISO8601IncludeTime": False,
            }
        ],
    }


def action(identifier: str, params: dict | None = None, action_uuid: str | None = None):
    body = dict(params or {})
    if action_uuid:
        body["UUID"] = action_uuid
    return {
        "WFWorkflowActionIdentifier": identifier,
        "WFWorkflowActionParameters": body,
    }


def build_actions() -> list:
    built = []

    def add(identifier, params=None, action_uuid=None):
        action_uuid = action_uuid or uid()
        built.append(action(identifier, params, action_uuid))
        return action_uuid

    def start_if(grouping, condition, wf_input, number=None):
        params = {
            "GroupingIdentifier": grouping,
            "WFControlFlowMode": 0,
            "WFCondition": condition,
            "WFInput": wf_input,
        }
        if number is not None:
            params["WFNumberValue"] = number
        add("is.workflow.actions.conditional", params)

    def otherwise(grouping):
        add(
            "is.workflow.actions.conditional",
            {"GroupingIdentifier": grouping, "WFControlFlowMode": 1},
        )

    def end_if(grouping):
        add(
            "is.workflow.actions.conditional",
            {"GroupingIdentifier": grouping, "WFControlFlowMode": 2},
        )

    def set_var(name: str, output_name: str, output_uuid: str):
        add(
            "is.workflow.actions.setvariable",
            {
                "WFVariableName": name,
                "WFInput": var_attachment(output_name, output_uuid),
            },
        )

    def set_flag():
        add(
            "is.workflow.actions.setvariable",
            {
                "WFVariableName": "有交易",
                "WFInput": token_string([FLAG]),
            },
        )

    add("is.workflow.actions.comment", {"WFCommentActionText": COMMENT})

    # Import question rewrites this string. Later actions read its output,
    # so a different note title typed at install time is what gets searched.
    note_name_uuid = add(
        "is.workflow.actions.gettext",
        {"WFTextActionText": NOTE_NAME},
    )
    merchant_uuid = add(
        "is.workflow.actions.gettext",
        {"WFTextActionText": token_string([shortcut_input_property("Merchant")])},
    )
    name_uuid = add(
        "is.workflow.actions.gettext",
        {"WFTextActionText": token_string([shortcut_input_property("Name")])},
    )

    merchant_group = uid()
    start_if(
        merchant_group,
        100,
        if_input_from(var_attachment("Text", merchant_uuid)),
    )
    set_var("商戶", "Text", merchant_uuid)
    set_flag()
    otherwise(merchant_group)
    name_group = uid()
    start_if(name_group, 100, if_input_from(var_attachment("Text", name_uuid)))
    set_var("商戶", "Text", name_uuid)
    set_flag()
    otherwise(name_group)
    end_if(name_group)
    end_if(merchant_group)

    amount_uuid = add(
        "is.workflow.actions.gettext",
        {"WFTextActionText": token_string([shortcut_input_property("Amount")])},
    )
    amount_group = uid()
    start_if(amount_group, 100, if_input_from(var_attachment("Text", amount_uuid)))
    set_var("金額", "Text", amount_uuid)
    set_flag()
    otherwise(amount_group)
    end_if(amount_group)

    line_uuid = add(
        "is.workflow.actions.gettext",
        {
            "WFTextActionText": token_string(
                [
                    current_date_short(),
                    PIPE,
                    named_var("商戶"),
                    PIPE,
                    named_var("金額"),
                ]
            )
        },
    )
    set_var("記帳一行", "Text", line_uuid)

    has_tx = uid()
    start_if(has_tx, 100, if_input_named("有交易"))

    find_uuid = add(
        "is.workflow.actions.filter.notes",
        {
            "WFContentItemFilter": {
                "Value": {
                    "WFActionParameterFilterPrefix": 1,
                    "WFContentPredicateBoundedDate": False,
                    "WFActionParameterFilterTemplates": [
                        {
                            "Operator": 99,
                            "Property": "Name",
                            "Removable": True,
                            "Values": {
                                "Unit": 4,
                                "String": token_string(
                                    [action_output("Text", note_name_uuid)]
                                ),
                            },
                        }
                    ],
                },
                "WFSerializationType": "WFContentPredicateTableTemplate",
            },
            "WFContentItemSortProperty": "Name",
            "WFContentItemSortOrder": "A to Z",
            "WFContentItemLimitEnabled": True,
            "WFContentItemLimitNumber": 1,
        },
    )
    count_uuid = add(
        "is.workflow.actions.count",
        {
            "WFCountType": "Items",
            "WFInput": var_attachment("Notes", find_uuid),
        },
    )
    found_group = uid()
    start_if(
        found_group,
        2,
        if_input_from(var_attachment("Count", count_uuid)),
        number=0,
    )
    first_uuid = add(
        "is.workflow.actions.getitemfromlist",
        {
            "WFInput": var_attachment("Notes", find_uuid),
            "WFItemSpecifier": "First Item",
        },
    )
    append_text_uuid = add(
        "is.workflow.actions.gettext",
        {"WFTextActionText": token_string([named_var("記帳一行"), "\n"])},
    )
    add(
        "is.workflow.actions.appendnote",
        {
            "WFInput": var_attachment("Text", append_text_uuid),
            "WFNote": var_attachment("Item from List", first_uuid),
            "IntentAppIdentifier": "com.apple.mobilenotes",
            "operation": "append",
            "interpretAsMarkdown": False,
            "ignoreWhitespace": False,
        },
    )
    add(
        "is.workflow.actions.notification",
        {
            "WFNotificationActionTitle": NOTIFY_TITLE,
            "WFNotificationActionBody": token_string([named_var("記帳一行")]),
            "WFNotificationActionSound": True,
        },
    )
    otherwise(found_group)
    add(
        "is.workflow.actions.alert",
        {
            "WFAlertActionTitle": NO_NOTE_TITLE,
            "WFAlertActionMessage": token_string(
                [
                    NO_NOTE_LEAD,
                    action_output("Text", note_name_uuid),
                    NO_NOTE_TAIL,
                ]
            ),
            "WFAlertActionCancelButtonShown": False,
        },
    )
    add("is.workflow.actions.exit", {})
    end_if(found_group)

    otherwise(has_tx)
    add(
        "is.workflow.actions.alert",
        {
            "WFAlertActionTitle": NO_TX_TITLE,
            "WFAlertActionMessage": NO_TX_MESSAGE,
            "WFAlertActionCancelButtonShown": False,
        },
    )
    add("is.workflow.actions.exit", {})
    end_if(has_tx)
    return built


def note_name_action_index(actions: list) -> int:
    matches = [
        index
        for index, item in enumerate(actions)
        if item["WFWorkflowActionParameters"].get("WFTextActionText") == NOTE_NAME
    ]
    if len(matches) != 1:
        raise AssertionError(f"expected one note-name text action, found {matches}")
    return matches[0]


def build_plist(actions: list) -> dict:
    question_index = note_name_action_index(actions)
    return {
        "WFWorkflowClientVersion": "3107.0.8.2",
        "WFWorkflowClientRelease": "22.1",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowTypes": [],
        "WFWorkflowName": NAME,
        "WFWorkflowIcon": {
            "WFWorkflowIconStartColor": 885374463,
            "WFWorkflowIconGlyphNumber": 59791,
        },
        "WFWorkflowImportQuestions": [
            {
                "ActionIndex": question_index,
                "Category": "Parameter",
                "DefaultValue": NOTE_NAME,
                "ParameterKey": "WFTextActionText",
                "Text": "備忘錄名稱要包含邊幾個字？通常唔使改，保持下面個名就得。",
            }
        ],
        "WFWorkflowInputContentItemClasses": [
            "WFWalletTransactionContentItem",
            "WFDictionaryContentItem",
            "WFStringContentItem",
        ],
        "WFWorkflowHasShortcutInputVariables": True,
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowHasOutputFallback": False,
        "WFWorkflowActions": actions,
    }


def _stack_at(actions: list, index: int):
    stack = []
    for i, item in enumerate(actions):
        if i == index:
            return stack
        if item["WFWorkflowActionIdentifier"] != "is.workflow.actions.conditional":
            continue
        params = item["WFWorkflowActionParameters"]
        mode = params.get("WFControlFlowMode")
        if mode == 0:
            stack.append(params.get("GroupingIdentifier"))
        elif mode == 2:
            stack.pop()
    raise AssertionError("index past end")


def _walk_token_strings(obj, path: str = "") -> None:
    if isinstance(obj, dict):
        if obj.get("WFSerializationType") == "WFTextTokenString":
            value = obj["Value"]
            text = value["string"]
            attachments = value.get("attachmentsByRange") or {}
            positions = []
            cursor = 0
            for char in text:
                if char == "\ufffc":
                    positions.append(cursor)
                cursor += utf16_len(char)
            keys = []
            for key in attachments:
                match = re.fullmatch(r"\{(\d+), 1\}", key)
                assert match, f"{path} bad range {key}"
                keys.append(int(match.group(1)))
            assert sorted(keys) == positions, (path, keys, positions, text)
        for key, value in obj.items():
            _walk_token_strings(value, f"{path}.{key}")
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            _walk_token_strings(value, f"{path}[{index}]")


def validate(actions: list, plist_obj: dict) -> None:
    assert utf16_len(NO_NOTE_LEAD) == len(NO_NOTE_LEAD)
    assert utf16_len(PIPE) == 1
    assert NOTE_NAME in COMMENT
    assert "Wallet 觸發" in COMMENT
    assert "iOS 27" in COMMENT
    assert actions[0]["WFWorkflowActionParameters"]["WFCommentActionText"] == COMMENT

    note_index = note_name_action_index(actions)
    questions = plist_obj["WFWorkflowImportQuestions"]
    assert len(questions) == 1
    assert questions[0]["ActionIndex"] == note_index
    assert questions[0]["ParameterKey"] == "WFTextActionText"
    assert questions[0]["DefaultValue"] == NOTE_NAME
    assert questions[0]["Category"] == "Parameter"

    identifiers = [item["WFWorkflowActionIdentifier"] for item in actions]
    assert identifiers[0] == "is.workflow.actions.comment"
    assert identifiers[1] == "is.workflow.actions.gettext"
    assert identifiers.count("is.workflow.actions.filter.notes") == 1
    assert identifiers.count("is.workflow.actions.appendnote") == 1
    assert identifiers.count("is.workflow.actions.notification") == 1
    assert identifiers.count("is.workflow.actions.alert") == 2
    assert identifiers.count("is.workflow.actions.exit") == 2
    assert "ActionExtension" not in plist_obj["WFWorkflowTypes"]
    assert plist_obj["WFWorkflowName"] == NAME
    assert plist_obj["WFWorkflowHasShortcutInputVariables"] is True
    assert "WFWalletTransactionContentItem" in plist_obj["WFWorkflowInputContentItemClasses"]

    stack = []
    for item in actions:
        if item["WFWorkflowActionIdentifier"] != "is.workflow.actions.conditional":
            continue
        params = item["WFWorkflowActionParameters"]
        mode = params.get("WFControlFlowMode")
        if mode == 0:
            assert params.get("WFCondition") in (2, 100)
            assert "WFInput" in params
            stack.append(params.get("GroupingIdentifier"))
        elif mode == 1:
            assert stack[-1] == params.get("GroupingIdentifier")
            assert "WFCondition" not in params
        elif mode == 2:
            assert stack.pop() == params.get("GroupingIdentifier")
    assert stack == []

    properties = []

    def collect_properties(obj):
        if isinstance(obj, dict):
            if obj.get("Type") == "WFPropertyVariableAggrandizement":
                properties.append(obj.get("PropertyName"))
            for value in obj.values():
                collect_properties(value)
        elif isinstance(obj, list):
            for value in obj:
                collect_properties(value)

    collect_properties(actions)
    assert properties == ["Merchant", "Name", "Amount"]

    find_action = next(
        item
        for item in actions
        if item["WFWorkflowActionIdentifier"] == "is.workflow.actions.filter.notes"
    )
    template = find_action["WFWorkflowActionParameters"]["WFContentItemFilter"]["Value"][
        "WFActionParameterFilterTemplates"
    ][0]
    assert template["Operator"] == 99
    assert template["Property"] == "Name"
    find_uuid = find_action["WFWorkflowActionParameters"]["UUID"]
    note_uuid = actions[note_index]["WFWorkflowActionParameters"]["UUID"]
    filter_blob = json.dumps(template, ensure_ascii=False)
    assert note_uuid in filter_blob
    assert find_action["WFWorkflowActionParameters"]["WFContentItemLimitNumber"] == 1

    append_action = next(
        item
        for item in actions
        if item["WFWorkflowActionIdentifier"] == "is.workflow.actions.appendnote"
    )
    append_params = append_action["WFWorkflowActionParameters"]
    assert append_params["operation"] == "append"
    assert append_params["interpretAsMarkdown"] is False
    assert append_params["WFNote"]["Value"]["OutputName"] == "Item from List"
    assert append_params["IntentAppIdentifier"] == "com.apple.mobilenotes"
    assert _stack_at(actions, actions.index(append_action))

    line_actions = [
        item
        for item in actions
        if item["WFWorkflowActionIdentifier"] == "is.workflow.actions.gettext"
        and isinstance(item["WFWorkflowActionParameters"].get("WFTextActionText"), dict)
    ]
    line_strings = [
        item["WFWorkflowActionParameters"]["WFTextActionText"]["Value"]["string"]
        for item in line_actions
    ]
    assert f"\ufffc{PIPE}\ufffc{PIPE}\ufffc" in line_strings
    assert "\ufffc\n" in line_strings

    alerts = [
        item["WFWorkflowActionParameters"]
        for item in actions
        if item["WFWorkflowActionIdentifier"] == "is.workflow.actions.alert"
    ]
    assert {item["WFAlertActionTitle"] for item in alerts} == {NO_NOTE_TITLE, NO_TX_TITLE}
    no_note = next(item for item in alerts if item["WFAlertActionTitle"] == NO_NOTE_TITLE)
    assert note_uuid in json.dumps(no_note, ensure_ascii=False)
    assert NO_NOTE_LEAD in no_note["WFAlertActionMessage"]["Value"]["string"]

    notification = next(
        item
        for item in actions
        if item["WFWorkflowActionIdentifier"] == "is.workflow.actions.notification"
    )
    assert notification["WFWorkflowActionParameters"]["WFNotificationActionTitle"] == NOTIFY_TITLE
    assert (
        notification["WFWorkflowActionParameters"]["WFNotificationActionBody"]["WFSerializationType"]
        == "WFTextTokenString"
    )

    # Find Notes and Append stay inside「有交易」. The missing-note alert
    # stays in the count==0 branch, never on the success path.
    find_index = actions.index(find_action)
    append_index = actions.index(append_action)
    notify_index = actions.index(notification)
    assert find_uuid
    for index in (find_index, append_index, notify_index):
        assert _stack_at(actions, index)

    no_note_index = next(
        index
        for index, item in enumerate(actions)
        if item["WFWorkflowActionParameters"].get("WFAlertActionTitle") == NO_NOTE_TITLE
    )
    no_tx_index = next(
        index
        for index, item in enumerate(actions)
        if item["WFWorkflowActionParameters"].get("WFAlertActionTitle") == NO_TX_TITLE
    )
    assert no_note_index > find_index
    assert no_tx_index > notify_index

    _walk_token_strings(plist_obj)

    page = (OUT_DIR / "index.html").read_text(encoding="utf-8")
    for needle in (
        VERSION,
        NOTE_NAME,
        SIGNED_FILENAME,
        NAME,
        "當我輕點錢包卡",
        "iOS 27",
        "可更改",
        "唔好上鎖",
        "實體卡",
        "現金",
        "PingFang HK",
        "safe-area-inset",
        "立即執行",
    ):
        assert needle in page, needle


def sign(plist_obj: dict, name: str) -> bytes:
    xml = plistlib.dumps(plist_obj, fmt=plistlib.FMT_XML).decode()
    payload = json.dumps({"shortcutName": name, "shortcut": xml}).encode()
    req = Request(
        HUBSIGN_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "cherri/1.0",
            "Origin": "https://routinehub.co",
            "Referer": "https://routinehub.co/",
        },
        method="POST",
    )
    with urlopen(req, timeout=60) as resp:
        data = resp.read()
    if data[:4] != b"AEA1":
        raise RuntimeError(f"HubSign bad magic: {data[:80]!r}")
    return data


def main():
    actions = build_actions()
    plist_obj = build_plist(actions)
    validate(actions, plist_obj)
    unsigned_path = OUT_DIR / UNSIGNED_FILENAME
    unsigned_path.write_bytes(plistlib.dumps(plist_obj, fmt=plistlib.FMT_XML))
    if "--check" in sys.argv:
        print(f"shortcut structure OK ({len(actions)} actions)")
        print(f"unsigned {unsigned_path} ({unsigned_path.stat().st_size} bytes)")
        return

    failed_path = OUT_DIR / "HUBSIGN_FAILED.txt"
    try:
        signed = sign(plist_obj, NAME)
    except (HTTPError, URLError, TimeoutError, RuntimeError, OSError) as exc:
        detail = str(exc)
        if isinstance(exc, HTTPError):
            detail = f"HTTP {exc.code} {exc.read()[:400]!r}"
        failed_path.write_text(
            "HubSign 簽署失敗。未有已簽署嘅 .shortcut。\n"
            f"{detail}\n\n"
            "未簽署檔：ApplePay記帳.unsigned.plist\n"
            "可以喺 Mac 用「捷徑」打開呢個 plist 再分享，或者喺 iPhone 跟安裝頁嘅人手步驟砌。\n",
            encoding="utf-8",
        )
        print(f"HUBSIGN FAILED {detail}")
        sys.exit(2)

    if failed_path.exists():
        failed_path.unlink()
    signed_path = OUT_DIR / SIGNED_FILENAME
    signed_path.write_bytes(signed)
    print(f"SIGNED OK {signed_path} ({len(signed)} bytes) magic={signed[:4]!r}")
    print(f"unsigned {unsigned_path} ({unsigned_path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
