#!/usr/bin/env python3
"""Build and HubSign the「IG存相」shortcut.

Share sheet:
  1. Detect Links on Shortcut Input. A post/reel URL opens Scriptable.
  2. Otherwise, if the share contains images, save them and stop.
     Clipboard is not read on this path.
  3. Text with no post URL and no image: alert, then stop.

Shortcuts app (no Shortcut Input):
  Read the clipboard once. An Instagram post URL opens Scriptable.
  Otherwise alert and stop. Never asks Scriptable to paste a link.
"""

from __future__ import annotations

import json
import plistlib
import re
import sys
import uuid
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

OUT_DIR = Path(__file__).resolve().parent
NAME = "IG存相"
SCRIPT_NAME = "IG存相解析"
HUBSIGN_URL = "https://hubsign.routinehub.services/sign"
SCRIPTABLE_RUN = (
    "scriptable:///run?scriptName=" + quote(SCRIPT_NAME, safe="") + "&url="
)
IG_POST_RE = (
    r"https?://(?:[A-Za-z0-9-]+\.)*(?:instagram\.com|instagr\.am)"
    r"/(?:p|reel|reels|tv|share)/\S+"
)
POST_URL_VAR = "貼文網址"
NO_MEDIA_TITLE = "未存到相"
NO_MEDIA_MESSAGE = (
    "分享入面冇相，亦都冇 IG 貼文連結。\n\n"
    "請喺 IG 撳「複製連結」，然後打開「捷徑」App，撳一次「IG存相」。\n"
    "唔好留喺分享畫面等。"
)
SAVED_TITLE = "已存入相簿"
SAVED_BODY = "單圖已存。輪播要全部或要更清：先喺 IG 複製連結，再喺捷徑 App 跑一次。"
SAVED_RESULT = (
    "已存入相簿。\n\n"
    "呢張係分享出嚟嘅相，未必係最高清。\n"
    "輪播想要全部、或者要更清：喺 IG 撳「複製連結」，"
    "再開「捷徑」App，撳一次「IG存相」。"
)


def uid() -> str:
    return str(uuid.uuid4()).upper()


def var_attachment(output_name: str, output_uuid: str):
    return {
        "Value": {
            "OutputName": output_name,
            "OutputUUID": output_uuid,
            "Type": "ActionOutput",
        },
        "WFSerializationType": "WFTextTokenAttachment",
    }


def named_var_attachment(name: str):
    return {
        "Value": {"Type": "Variable", "VariableName": name},
        "WFSerializationType": "WFTextTokenAttachment",
    }


def extension_input():
    return {
        "Value": {"Type": "ExtensionInput"},
        "WFSerializationType": "WFTextTokenAttachment",
    }


def if_input_from(attachment: dict):
    return {"Type": "Variable", "Variable": attachment}


def text_named_vars(parts):
    s = ""
    attachments = {}
    for part in parts:
        if isinstance(part, tuple) and part[0] == "var":
            start = len(s)
            s += "\ufffc"
            attachments[f"{{{start}, 1}}"] = {
                "Type": "Variable",
                "VariableName": part[1],
            }
        else:
            s += str(part)
    return {
        "Value": {"attachmentsByRange": attachments, "string": s},
        "WFSerializationType": "WFTextTokenString",
    }


def token_string_action_output(output_name: str, output_uuid: str, prefix: str = ""):
    # Prefix is ASCII, so Python len matches the UTF-16 length Shortcuts stores.
    start = len(prefix)
    return {
        "Value": {
            "attachmentsByRange": {
                f"{{{start}, 1}}": {
                    "Type": "ActionOutput",
                    "OutputName": output_name,
                    "OutputUUID": output_uuid,
                }
            },
            "string": prefix + "\ufffc",
        },
        "WFSerializationType": "WFTextTokenString",
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

    def add_match_and_store(urls_uuid: str):
        text_uuid = add(
            "is.workflow.actions.gettext",
            {"WFTextActionText": token_string_action_output("URLs", urls_uuid)},
        )
        match_uuid = add(
            "is.workflow.actions.text.match",
            {
                "WFMatchTextCaseSensitive": False,
                "WFMatchTextPattern": IG_POST_RE,
                "text": token_string_action_output("Text", text_uuid),
            },
        )
        grouping = uid()
        start_if(grouping, 100, if_input_from(var_attachment("Matches", match_uuid)))
        first_uuid = add(
            "is.workflow.actions.getitemfromlist",
            {
                "WFInput": var_attachment("Matches", match_uuid),
                "WFItemSpecifier": "First Item",
            },
        )
        add(
            "is.workflow.actions.setvariable",
            {
                "WFVariableName": POST_URL_VAR,
                "WFInput": var_attachment("Item from List", first_uuid),
            },
        )
        end_if(grouping)

    def add_open_scriptable():
        text_uuid = add(
            "is.workflow.actions.gettext",
            {"WFTextActionText": text_named_vars([("var", POST_URL_VAR)])},
        )
        encoded_uuid = add(
            "is.workflow.actions.urlencode",
            {"WFInput": var_attachment("Text", text_uuid)},
        )
        scheme_uuid = add(
            "is.workflow.actions.gettext",
            {
                "WFTextActionText": token_string_action_output(
                    "URL Encoded Text", encoded_uuid, SCRIPTABLE_RUN
                )
            },
        )
        # No WFShowWorkflow: that flag is Wait to Return, which leaves the shortcut spinning.
        add(
            "is.workflow.actions.openurl",
            {"WFInput": var_attachment("Text", scheme_uuid)},
        )

    def add_give_up():
        add(
            "is.workflow.actions.alert",
            {
                "WFAlertActionTitle": NO_MEDIA_TITLE,
                "WFAlertActionMessage": NO_MEDIA_MESSAGE,
                "WFAlertActionCancelButtonShown": False,
            },
        )
        add("is.workflow.actions.exit", {})

    add(
        "is.workflow.actions.comment",
        {
            "WFCommentActionText": (
                "【IG存相 1.4】\n"
                "分享有貼文連結：打開 Scriptable 存原圖／輪播。\n"
                "分享有相但冇連結：直接存入相簿，然後停止。\n"
                "分享面板唔讀剪貼簿，亦都唔等 Scriptable 返回。\n"
                "冇輸入（喺捷徑 App 自己跑）：先至讀剪貼簿。\n"
                "冇連結又冇相：提示複製連結，然後停止。"
            )
        },
    )

    urls_uuid = add(
        "is.workflow.actions.detect.link",
        {"WFInput": extension_input()},
    )
    url_count_uuid = add(
        "is.workflow.actions.count",
        {"WFCountType": "Items", "WFInput": var_attachment("URLs", urls_uuid)},
    )
    url_group = uid()
    start_if(
        url_group,
        2,
        if_input_from(var_attachment("Count", url_count_uuid)),
        number=0,
    )
    add_match_and_store(urls_uuid)
    end_if(url_group)

    has_url = uid()
    start_if(has_url, 100, if_input_from(named_var_attachment(POST_URL_VAR)))
    add_open_scriptable()
    otherwise(has_url)

    images_uuid = add(
        "is.workflow.actions.detect.images",
        {"WFInput": extension_input()},
    )
    image_count_uuid = add(
        "is.workflow.actions.count",
        {"WFCountType": "Items", "WFInput": var_attachment("Images", images_uuid)},
    )
    image_group = uid()
    start_if(
        image_group,
        2,
        if_input_from(var_attachment("Count", image_count_uuid)),
        number=0,
    )
    add(
        "is.workflow.actions.savetocameraroll",
        {"WFInput": var_attachment("Images", images_uuid)},
    )
    add(
        "is.workflow.actions.notification",
        {
            "WFNotificationActionTitle": SAVED_TITLE,
            "WFNotificationActionBody": SAVED_BODY,
            "WFNotificationActionSound": True,
        },
    )
    add("is.workflow.actions.showresult", {"Text": SAVED_RESULT})
    add("is.workflow.actions.exit", {})
    otherwise(image_group)

    empty_input = uid()
    start_if(empty_input, 101, if_input_from(extension_input()))
    clip_uuid = add("is.workflow.actions.getclipboard", {})
    clip_urls_uuid = add(
        "is.workflow.actions.detect.link",
        {"WFInput": var_attachment("Clipboard", clip_uuid)},
    )
    clip_count_uuid = add(
        "is.workflow.actions.count",
        {
            "WFCountType": "Items",
            "WFInput": var_attachment("URLs", clip_urls_uuid),
        },
    )
    clip_group = uid()
    start_if(
        clip_group,
        2,
        if_input_from(var_attachment("Count", clip_count_uuid)),
        number=0,
    )
    add_match_and_store(clip_urls_uuid)
    end_if(clip_group)

    clip_url = uid()
    start_if(clip_url, 100, if_input_from(named_var_attachment(POST_URL_VAR)))
    add_open_scriptable()
    otherwise(clip_url)
    add_give_up()
    end_if(clip_url)
    otherwise(empty_input)
    add_give_up()
    end_if(empty_input)

    end_if(image_group)
    end_if(has_url)
    return built


def build_plist(actions: list) -> dict:
    return {
        "WFWorkflowClientVersion": "3107.0.8.2",
        "WFWorkflowClientRelease": "22.1",
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowTypes": ["ActionExtension", "NCWidget", "WatchKit"],
        "WFWorkflowName": NAME,
        "WFWorkflowIcon": {
            "WFWorkflowIconStartColor": 463140863,
            "WFWorkflowIconGlyphNumber": 59836,
        },
        "WFWorkflowImportQuestions": [],
        "WFWorkflowInputContentItemClasses": [
            "WFImageContentItem",
            "WFGenericFileContentItem",
            "WFURLContentItem",
            "WFStringContentItem",
            "WFRichTextContentItem",
            "WFSafariWebPageContentItem",
            "WFArticleContentItem",
        ],
        "WFWorkflowHasShortcutInputVariables": True,
        "WFWorkflowOutputContentItemClasses": [],
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
            stack.append({"cond": params.get("WFCondition"), "branch": "if"})
        elif mode == 1:
            stack[-1]["branch"] = "else"
        elif mode == 2:
            stack.pop()
    raise AssertionError("index past end")


def validate(actions: list, plist_obj: dict) -> None:
    assert quote(SCRIPT_NAME, safe="") == "IG%E5%AD%98%E7%9B%B8%E8%A7%A3%E6%9E%90"
    assert SCRIPTABLE_RUN.endswith("&url=")
    post_re = re.compile(IG_POST_RE, re.I)
    assert post_re.search("https://www.instagram.com/p/ABC123/?igsh=zzz")
    assert post_re.search("https://instagram.com/reel/AbC_d")
    assert post_re.search("https://www.instagram.com/share/XYZ")
    assert not post_re.search("https://www.instagram.com/someuser/")
    assert not post_re.search("https://example.com/p/ABC")

    identifiers = [item["WFWorkflowActionIdentifier"] for item in actions]
    assert identifiers.count("is.workflow.actions.detect.link") == 2
    assert identifiers.count("is.workflow.actions.detect.images") == 1
    assert identifiers.count("is.workflow.actions.savetocameraroll") == 1
    assert identifiers.count("is.workflow.actions.getclipboard") == 1
    assert identifiers.count("is.workflow.actions.openurl") == 2
    assert identifiers.count("is.workflow.actions.exit") == 3
    assert "is.workflow.actions.setclipboard" not in identifiers
    assert "is.workflow.actions.waittoreturn" not in identifiers
    assert "is.workflow.actions.delay" not in identifiers
    assert "WFImageContentItem" in plist_obj["WFWorkflowInputContentItemClasses"]

    stack = []
    for item in actions:
        params = item["WFWorkflowActionParameters"]
        assert params.get("WFShowWorkflow") is not True
        ident = item["WFWorkflowActionIdentifier"]
        if ident == "is.workflow.actions.conditional":
            mode = params.get("WFControlFlowMode")
            if mode == 0:
                stack.append(params.get("GroupingIdentifier"))
            elif mode == 1:
                assert stack[-1] == params.get("GroupingIdentifier")
            elif mode == 2:
                assert stack.pop() == params.get("GroupingIdentifier")
    assert stack == []

    for index, item in enumerate(actions):
        ident = item["WFWorkflowActionIdentifier"]
        active = _stack_at(actions, index)
        if ident == "is.workflow.actions.getclipboard":
            assert any(frame["cond"] == 101 and frame["branch"] == "if" for frame in active)
            assert not any(frame["cond"] == 2 and frame["branch"] == "if" for frame in active)
        if ident == "is.workflow.actions.savetocameraroll":
            assert any(frame["cond"] == 2 and frame["branch"] == "if" for frame in active)
            assert any(frame["cond"] == 100 and frame["branch"] == "else" for frame in active)
            assert not any(frame["cond"] == 101 for frame in active)
        if ident == "is.workflow.actions.openurl":
            assert any(frame["cond"] == 100 and frame["branch"] == "if" for frame in active)
            assert not any(frame["cond"] == 2 and frame["branch"] == "if" for frame in active)
        if ident == "is.workflow.actions.exit":
            assert not any(frame["cond"] == 100 and frame["branch"] == "if" for frame in active)

    blob = json.dumps(actions, ensure_ascii=False)
    assert SCRIPTABLE_RUN in blob
    assert "Wait to Return" not in blob
    assert "唔好留喺分享畫面等" in blob
    assert "未必係最高清" in blob


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
    if "--check" in sys.argv:
        print(f"shortcut structure OK ({len(actions)} actions)")
        return

    signed = sign(plist_obj, NAME)
    signed_path = OUT_DIR / "IG-save.shortcut"
    signed_path.write_bytes(signed)
    print(f"SIGNED OK {signed_path} ({len(signed)} bytes)")


if __name__ == "__main__":
    main()
