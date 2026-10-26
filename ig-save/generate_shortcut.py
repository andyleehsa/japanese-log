#!/usr/bin/env python3
"""Build and HubSign the「IG存相」shortcut.

1.4 failed on a real phone: after Copy Link, running the shortcut in the
Shortcuts app ended with no alert and Scriptable never opened. That branch
fed a Text value to Open URL and showed no UI first. An empty Shortcut Input
can also look like "has a value", so a Has No Value (101) gate skipped the
clipboard and was the wrong switch.

1.6: the shortcut still opens scriptable:// only. It must not open
instagram.com. The script reads the page with Request, and only falls
back to a WebView URL that ends in #weblink so iOS does not hand the
page to the Instagram app.

1.5:
  1. Detect Links + Match on Shortcut Input.
  2. If that found no post URL, read the clipboard as text, Detect Links,
     and also Match the raw text. Not gated on Shortcut Input being empty.
  3. If there is still no URL but there are images, save them and show a result.
  4. If there is a URL, alert with the link, turn the text into a URL item,
     then Open URL. No Wait to Return.
  5. If there is nothing, alert and stop. No branch ends silently.
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
# Any instagram host, including /p/ /reel/ /reels/ /tv/ /share/, l.instagram.com,
# instagr.am short links, and copy-link query strings such as igsh=.
IG_POST_RE = (
    r"https?://(?:[A-Za-z0-9-]+\.)*(?:instagram\.com|instagr\.am)[^\s]*"
)
POST_URL_VAR = "貼文網址"
NO_MEDIA_TITLE = "未存到相"
NO_MEDIA_MESSAGE = (
    "未搵到相，亦都冇 IG 連結。\n\n"
    "最穩陣：喺 IG 撳「複製連結」，打開 Scriptable，撳「IG存相解析」播放。\n\n"
    "輪播分享通常唔帶相同連結，一定要先複製連結。"
)
SAVED_TITLE = "已存入相簿"
SAVED_BODY = "單圖已存。輪播要全部：先複製連結，再開 Scriptable 撳「IG存相解析」播放。"
SAVED_RESULT = (
    "已存入相簿。\n\n"
    "呢張係分享出嚟嘅相，未必係最高清。\n"
    "輪播想要全部：喺 IG 撳「複製連結」，打開 Scriptable，撳「IG存相解析」播放。"
)
OPEN_TITLE = "即將打開 Scriptable"
OPEN_LEAD = "即將打開 Scriptable 存相。\n連結：\n"
OPEN_TAIL = (
    "\n\n如果跟住冇見到「IG存相 1.9.2-ig-photos」，"
    "請自己打開 Scriptable，撳「IG存相解析」播放。"
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

    def add_match_text_and_store(text_uuid: str, output_name: str = "Text"):
        match_uuid = add(
            "is.workflow.actions.text.match",
            {
                "WFMatchTextCaseSensitive": False,
                "WFMatchTextPattern": IG_POST_RE,
                "text": token_string_action_output(output_name, text_uuid),
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

    def add_match_and_store(urls_uuid: str):
        text_uuid = add(
            "is.workflow.actions.gettext",
            {"WFTextActionText": token_string_action_output("URLs", urls_uuid)},
        )
        add_match_text_and_store(text_uuid, "Text")

    def alert_open_message():
        # CJK in this lead is BMP, so Python len equals the UTF-16 length Shortcuts stores.
        lead = OPEN_LEAD
        body = lead + "\ufffc" + OPEN_TAIL
        return {
            "Value": {
                "attachmentsByRange": {
                    f"{{{len(lead)}, 1}}": {
                        "Type": "Variable",
                        "VariableName": POST_URL_VAR,
                    }
                },
                "string": body,
            },
            "WFSerializationType": "WFTextTokenString",
        }

    def add_open_scriptable():
        add(
            "is.workflow.actions.alert",
            {
                "WFAlertActionTitle": OPEN_TITLE,
                "WFAlertActionMessage": alert_open_message(),
                "WFAlertActionCancelButtonShown": False,
            },
        )
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
        url_uuid = add(
            "is.workflow.actions.url",
            {"WFURLActionURL": token_string_action_output("Text", scheme_uuid)},
        )
        # Open the URL item, not the Text. No WFShowWorkflow (Wait to Return).
        add(
            "is.workflow.actions.openurl",
            {"WFInput": var_attachment("URL", url_uuid)},
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
                "【IG存相 1.9.2】\n"
                "先搵分享入面嘅 IG 連結。\n"
                "未有連結就讀剪貼簿。\n"
                "有連結：先彈「即將打開 Scriptable」同條連結，再打開 scriptable://。\n"
                "唔好直接打開 instagram.com。腳本只用網絡請求，唔會開 IG App。\n"
                "未有連結但有相：存入相簿並顯示結果。\n"
                "乜都冇：彈提示然後停止。"
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

    clip_uuid = add("is.workflow.actions.getclipboard", {})
    clip_text_uuid = add(
        "is.workflow.actions.gettext",
        {"WFTextActionText": token_string_action_output("Clipboard", clip_uuid)},
    )
    clip_urls_uuid = add(
        "is.workflow.actions.detect.link",
        {"WFInput": var_attachment("Text", clip_text_uuid)},
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

    raw_group = uid()
    start_if(raw_group, 100, if_input_from(named_var_attachment(POST_URL_VAR)))
    otherwise(raw_group)
    add_match_text_and_store(clip_text_uuid, "Text")
    end_if(raw_group)

    clip_url = uid()
    start_if(clip_url, 100, if_input_from(named_var_attachment(POST_URL_VAR)))
    add_open_scriptable()
    otherwise(clip_url)

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
    add_give_up()
    end_if(image_group)

    end_if(clip_url)
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
    assert len(OPEN_LEAD) == len(OPEN_LEAD.encode("utf-16-le")) // 2
    post_re = re.compile(IG_POST_RE, re.I)
    samples = [
        "https://www.instagram.com/p/ABC123/?igsh=zzz",
        "https://instagram.com/reel/AbC_d",
        "https://www.instagram.com/reels/AbC/",
        "https://www.instagram.com/tv/AbC/",
        "https://www.instagram.com/share/XYZ",
        "https://www.instagram.com/share/p/ABC123/?igsh=abc",
        "https://www.instagram.com/share/reel/ABC123/",
        "https://instagr.am/p/AbC",
        "https://l.instagram.com/?u=https%3A%2F%2Fwww.instagram.com%2Fp%2FAbC%2F&e=1",
    ]
    for sample in samples:
        assert post_re.search(sample), sample
    assert not post_re.search("https://example.com/p/ABC")

    identifiers = [item["WFWorkflowActionIdentifier"] for item in actions]
    assert identifiers.count("is.workflow.actions.detect.link") == 2
    assert identifiers.count("is.workflow.actions.detect.images") == 1
    assert identifiers.count("is.workflow.actions.savetocameraroll") == 1
    assert identifiers.count("is.workflow.actions.getclipboard") == 1
    assert identifiers.count("is.workflow.actions.url") == 2
    assert identifiers.count("is.workflow.actions.openurl") == 2
    assert identifiers.count("is.workflow.actions.alert") == 3
    assert identifiers.count("is.workflow.actions.exit") == 2
    assert identifiers.count("is.workflow.actions.showresult") == 1
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
                assert params.get("WFCondition") != 101
                stack.append(params.get("GroupingIdentifier"))
            elif mode == 1:
                assert stack[-1] == params.get("GroupingIdentifier")
            elif mode == 2:
                assert stack.pop() == params.get("GroupingIdentifier")
    assert stack == []

    def visible_before(index: int) -> bool:
        for earlier in range(index - 1, -1, -1):
            previous = actions[earlier]
            previous_id = previous["WFWorkflowActionIdentifier"]
            if previous_id in (
                "is.workflow.actions.alert",
                "is.workflow.actions.showresult",
                "is.workflow.actions.notification",
            ):
                return True
            if previous_id == "is.workflow.actions.conditional":
                return False
        return False

    for index, item in enumerate(actions):
        ident = item["WFWorkflowActionIdentifier"]
        params = item["WFWorkflowActionParameters"]
        active = _stack_at(actions, index)
        if ident == "is.workflow.actions.getclipboard":
            assert not any(frame["cond"] == 101 for frame in active)
            assert any(frame["cond"] == 100 and frame["branch"] == "else" for frame in active)
        if ident == "is.workflow.actions.savetocameraroll":
            assert any(frame["cond"] == 2 and frame["branch"] == "if" for frame in active)
            assert any(frame["cond"] == 100 and frame["branch"] == "else" for frame in active)
        if ident == "is.workflow.actions.openurl":
            assert params["WFInput"]["Value"]["OutputName"] == "URL"
            assert params["WFInput"]["Value"]["Type"] == "ActionOutput"
            assert any(frame["cond"] == 100 and frame["branch"] == "if" for frame in active)
            assert not any(frame["cond"] == 2 and frame["branch"] == "if" for frame in active)
            saw_alert = False
            saw_url = False
            for earlier in range(index - 1, -1, -1):
                previous_id = actions[earlier]["WFWorkflowActionIdentifier"]
                if previous_id == "is.workflow.actions.alert":
                    saw_alert = True
                if previous_id == "is.workflow.actions.url":
                    saw_url = True
                if previous_id == "is.workflow.actions.conditional":
                    break
            assert saw_alert and saw_url
        if ident == "is.workflow.actions.exit":
            assert visible_before(index)
            assert not any(frame["cond"] == 100 and frame["branch"] == "if" for frame in active)

    blob = json.dumps(actions, ensure_ascii=False)
    assert SCRIPTABLE_RUN in blob
    assert "Wait to Return" not in blob
    assert "即將打開 Scriptable" in blob
    assert "IG存相解析" in blob
    assert "is.workflow.actions.url" in identifiers


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
