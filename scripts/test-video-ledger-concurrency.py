"""Run against an isolated PostgreSQL fixture, never a customer database.
Requires VIDEO_LEDGER_TEST_DSN; no provider calls. Ledger rows remain in that disposable DB.
"""
import concurrent.futures,json,os,subprocess,uuid
dsn=os.environ['VIDEO_LEDGER_TEST_DSN']
def sql(statement):
 return subprocess.check_output(['psql',dsn,'-X','-q','-t','-A','-v','ON_ERROR_STOP=1','-c',statement],text=True).strip()
user,entity,attempt=[str(uuid.uuid4()) for _ in range(3)]
sql(f"select public.grant_video_credits('{user}',8,'concurrency')")
def debit(_):
 return json.loads(sql(f"select public.debit_video_credits('{user}',8,'clip','{entity}','{attempt}')"))
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(debit,range(2)))
assert all(r['ok'] for r in results)
assert int(sql(f"select count(*) from video_credit_ledger where user_id='{user}' and delta<0"))==1
assert int(sql(f"select sum(delta) from video_credit_ledger where user_id='{user}'"))==0
sql(f"select public.refund_video_credits('{user}','clip','{entity}','{attempt}')")
def competing(_):
 return json.loads(sql(f"select public.debit_video_credits('{user}',8,'clip','{uuid.uuid4()}','{uuid.uuid4()}')"))
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(competing,range(2)))
assert sum(r['ok'] for r in results)==1
assert int(sql(f"select sum(delta) from video_credit_ledger where user_id='{user}'"))==0
print('Concurrent duplicate debit: once; competing debit: one winner, no overdraft.')