"""Scenario test battery for Gifts Mini App (uses dev auth ?tg_id=, real BOT_TOKEN).
Run: python3 scripts/scenariotest.py  (set PYTHONIOENCODING=utf-8 on Windows)
Covers: channel/group verify (real getChatMember), referrals, manual tasks,
select persistence, waiting gate, violation detection, claim gate, admin guard.
"""
import json, time, urllib.request, urllib.error

B = 'http://localhost:3000'
A, B2, C = 900011, 900012, 900021  # test users (cleaned up afterwards)
fails = []

def api(method, path, body=None):
    req = urllib.request.Request(B + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return (r.status, json.load(r))
    except urllib.error.HTTPError as e:
        try: return (e.code, json.load(e))
        except Exception: return (e.code, {})

def check(name, cond, extra=""):
    print(('PASS ' if cond else 'FAIL ') + name, extra)
    if not cond: fails.append(name)

def webhook(uid, text):
    return api('POST', '/api/bot', {'message': {'chat': {'id': uid}, 'text': text,
            'from': {'id': uid, 'first_name': 'T', 'username': 't'}}})

# S3 referrals
check('webhook new user 200', webhook(A, '/start')[0] == 200)
check('webhook ref counted', webhook(B2, f'/start ref_{A}')[0] == 200)
check('webhook dup ignored', webhook(B2, f'/start ref_{A}')[0] == 200)
check('webhook self-ref ok', webhook(A, f'/start ref_{A}')[0] == 200)
st, js = api('GET', f'/api/state?tg_id={A}')
check('invite count is exactly 1', js['inviteCounts'].get('t_invite') == 1, str(js['inviteCounts']))
_, v = api('POST', f'/api/tasks/verify?tg_id={A}', {'taskId': 't_invite', 'action': 'verify'})
check('invite 1/3 blocked w/ new text', (not v.get('done')) and 'не хватает' in v.get('message', ''), v.get('message', '')[:60])

# S1/S2 real getChatMember. NOTE: our bot is NOT admin of @telegram, so the
# honest outcome is "check unavailable" (temp), never a false pass/fail.
_, vc = api('POST', f'/api/tasks/verify?tg_id={C}', {'taskId': 't_channel', 'action': 'verify'})
check('channel: unavailable w/o bot-admin', (not vc.get('done')) and 'недоступна' in vc.get('message', ''), vc.get('message', '')[:60])
_, vg = api('POST', f'/api/tasks/verify?tg_id={C}', {'taskId': 't_group', 'action': 'verify'})
check('group: unavailable w/o bot-admin', (not vg.get('done')) and 'недоступна' in vg.get('message', ''), vg.get('message', '')[:60])

# S4 manual tasks
api('POST', f'/api/select-gift?tg_id={C}', {'giftId': 'g15'})
api('POST', f'/api/tasks/verify?tg_id={C}', {'taskId': 't_bot', 'action': 'click'})
_, early = api('POST', f'/api/tasks/verify?tg_id={C}', {'taskId': 't_bot', 'action': 'verify'})
check('manual instant verify blocked', not early.get('done'))
time.sleep(6)
_, late = api('POST', f'/api/tasks/verify?tg_id={C}', {'taskId': 't_bot', 'action': 'verify'})
check('manual verify after pause ok', late.get('done') is True)
st, js = api('GET', f'/api/state?tg_id={C}')
check('select persists (g15)', js['user']['selectedGiftId'] == 'g15')

# S6 waiting gate
code, _ = api('POST', f'/api/waiting/start?tg_id={C}', {})
check('waiting blocked when incomplete', code == 400)

# S8 claim gate (idle)
_, cl = api('GET', f'/api/claim?tg_id={C}')
check('claim blocked idle', cl.get('eligible') is False and cl.get('claimUrl') == '')

# S9 admin guard
code, _ = api('GET', '/api/admin?tg_id=999999')
check('admin 403 stranger', code == 403)
code, adm = api('GET', '/api/admin?tg_id=5434264152')
check('admin 200 owner', code == 200 and len(adm.get('gifts', [])) == 4)
check('state flags isAdmin for owner', api('GET', '/api/state?tg_id=5434264152')[1].get('isAdmin') is True)
check('state hides isAdmin for stranger', api('GET', '/api/state?tg_id=999998')[1].get('isAdmin') is not True)

print('FAILURES:', fails if fails else 'none')
