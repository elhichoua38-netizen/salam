# -*- coding: utf-8 -*-
"""
بوت تلغرام — جهاز التحكم في «صفحة الإشعارات»
============================================
كيف يعمل:
    1) أرسل /new للبوت فيعطيك رابط صفحتك.
    2) شارك الرابط مع من تريد.
    3) أي شخص يفتح الرابط وتظهر له نافذة «السماح بالإشعارات»
       فيوافق عليها → يصبح مشتركاً ويستقبل إشعاراتك على موبايله.
    4) أي رسالة نصية تكتبها أنت للبوت (أي نص ليس أمراً)
       تُبثّ فوراً كإشعار لكل المشتركين — حتى لو أغلقوا الموقع.

التشغيل:
    1) pip install requests
    2) عدّل BOT_TOKEN و SITE_URL و BROADCAST_SECRET بالأسفل
    3) python bot.py
    4) من حسابك: /start ثم /new ثم اكتب أي رسالة وجرّب!
"""
import re
import sys
import time
import uuid
from datetime import datetime

import requests

# دعم الطباعة العربية والإيموجي على جميع الأنظمة (خاصة Windows)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ============================================================
# 1) عدّل هنا:
# ============================================================
BOT_TOKEN = "8926551834:AAE1xE7JtHxY1cIWPkNTYbD9j579gV_aSyo"   # التوكن من @BotFather
SITE_URL = "https://اسم-موقعك.netlify.app"      # رابط موقعك بعد الرفع على Netlify
BROADCAST_SECRET = "5ef71a156ecf702bc668d92d68aa999ed849caf86e06742b"   # ضعه نفسه في إعدادات Netlify
OWNER_ID = 0        # اتركه 0 وسيُضبط تلقائياً على أول حساب يرسل /start
# ============================================================

API = f"https://api.telegram.org/bot{BOT_TOKEN}"
TIMEOUT = 40

links = {}


def tg(method, **params):
    try:
        r = requests.post(f"{API}/{method}", json=params, timeout=30)
        return r.json()
    except Exception as e:
        print("⚠️ خطأ في الاتصال بتلغرام:", e)
        return {"ok": False}


def send(chat_id, text):
    try:
        tg("sendMessage", chat_id=chat_id, text=text,
           parse_mode="HTML", disable_web_page_preview=True)
    except Exception as e:
        print("⚠️", e)


def broadcast(message):
    """إرسال الرسالة إلى دالة البث في Netlify التي توزعها كإشعارات."""
    try:
        r = requests.post(
            f"{SITE_URL}/.netlify/functions/broadcast",
            json={"message": message},
            headers={"x-broadcast-secret": BROADCAST_SECRET},
            timeout=40,
        )
        data = r.json()
        if data.get("ok"):
            return f"📡 تم البث بنجاح إلى {data.get('sent', 0)} جهاز ✅"
        return "😔 فشل البث من الخادم: " + str(data.get("error", "خطأ"))
    except Exception as e:
        return f"😔 تعذّر الاتصال بخادم Netlify: {e}"


def new_link():
    token = uuid.uuid4().hex[:12]
    links[token] = {"created": datetime.now()}
    return token


def link_url(token):
    return f"{SITE_URL}/?c={token}"


def handle(chat_id, text):
    global OWNER_ID
    t = (text or "").strip()
    low = t.lower()

    if OWNER_ID == 0 and chat_id > 0:
        OWNER_ID = chat_id
        print(f"✅ تم ضبط المالك تلقائياً على: {chat_id}")

    if OWNER_ID and chat_id != OWNER_ID:
        send(chat_id, "هذا البوت خاص بصاحبه فقط 🤖")
        return

    if low in ("/start", "/help", "/مساعدة"):
        send(
            chat_id,
            "👋 أهلًا! هذا البوت يتحكم في <b>صفحة الإشعارات</b>.\n\n"
            "<b>الأوامر:</b>\n"
            "• <b>/new</b> أو <b>/رابط</b> ← رابط صفحة توزّعه على الناس\n"
            "• <b>/links</b> أو <b>/روابط</b> ← روابطك المفعلة\n"
            "• <b>/del TOKEN</b> أو <b>/حذف TOKEN</b> ← إلغاء رابط\n\n"
            "<b>البث:</b> اكتب أي رسالة عادية هنا (ليست أمراً)\n"
            "وستصل فوراً <b>إشعاراً على موبايل كل شخص</b>\n"
            "فعّل الإشعارات من رابطك — حتى لو خرج من الموقع.",
        )
        return

    if low in ("/new", "/link", "/رابط"):
        token = new_link()
        send(
            chat_id,
            "🔗 هذا رابط صفحة الإشعارات:\n\n"
            f"<code>{link_url(token)}</code>\n\n"
            "شاركه مع من تريد — كل من يفتحه ويسمح بالإشعارات\n"
            "ستصله رسائلك البثية على موبايله فوراً.",
        )
        return

    if low in ("/links", "/روابط"):
        if not links:
            send(chat_id, "لا توجد روابط بعد. أرسل /new لإنشاء رابط.")
            return
        lines = [
            f"• <code>{link_url(tok)}</code> — أُنشئ {v['created']:%H:%M}"
            for tok, v in links.items()
        ]
        send(chat_id, "🟢 الروابط المفعلة:\n\n" + "\n".join(lines))
        return

    m = re.match(r"^/(?:del|حذف|remove)\s+([0-9a-f]{12})$", low)
    if m:
        token = m.group(1)
        if links.pop(token, None):
            send(chat_id, "🗑️ تم إلغاء هذا الرابط نهائياً.")
        else:
            send(chat_id, "ما وجدت رابطاً بهذا الرمز.")
        return

    # أي رسالة أخرى عادية = بث إشعار لكل المشتركين
    if len(t) > 2000:
        send(chat_id, "الرسالة طويلة جداً (الحد 2000 حرف).")
        return
    if t.startswith("/"):
        send(chat_id, "لم أفهم الأمر 🤔 أرسل /start لعرض الأوامر.")
        return
    if not t:
        return

    send(chat_id, "⏳ جارٍ البث إلى المشتركين...")
    result = broadcast(t)
    send(chat_id, result)


def main():
    if BOT_TOKEN.startswith("ضع_"):
        print("✋ عرّف BOT_TOKEN أولاً في الملف ثم شغّل البوت مجدداً.")
        return

    print("🤖 البوت يعمل... اضغط Ctrl+C للإيقاف")
    me = tg("getMe")
    if me.get("ok"):
        print("✅ تم الدخول كبوت: @" + me["result"]["username"])
    else:
        print("⚠️ تعذّر الدخول كبوت — تأكد من صحة التوكن.")
        return

    offset = 0
    while True:
        try:
            r = requests.post(
                f"{API}/getUpdates",
                json={"offset": offset, "timeout": TIMEOUT},
                timeout=TIMEOUT + 15,
            )
            for u in r.json().get("result", []):
                offset = u["update_id"] + 1
                msg = u.get("message") or u.get("edited_message")
                if not msg:
                    continue
                chat = msg["chat"]
                if chat["type"] == "private":
                    handle(chat["id"], msg.get("text", ""))
        except requests.exceptions.Timeout:
            pass
        except Exception as e:
            print("⚠️", e)
            time.sleep(3)


if __name__ == "__main__":
    main()
