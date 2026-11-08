import os,json,requests,uuid,concurrent.futures
url=os.environ['SUPABASE_URL']; key=os.environ['SUPABASE_SERVICE_ROLE_KEY']; pub=os.environ['SUPABASE_PUBLISHABLE_KEY']
with open(os.path.expanduser('~/.cache/lovable-auth/session.json')) as f: session=json.load(f)['session']
owner=session['user']['id']; admin={'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json','Prefer':'return=representation'}; user={'apikey':pub,'Authorization':'Bearer '+session['access_token'],'Content-Type':'application/json'}
def req(path,method='GET',data=None,h=admin):
 r=requests.request(method,url+'/rest/v1/'+path,headers=h,json=data); return r
p=str(uuid.uuid4()); s=str(uuid.uuid4()); foreign=str(uuid.uuid4())
assert req('video_inspiration_projects','POST',{'id':p,'user_id':foreign,'title':'Isolation test'}).ok
assert req('storyboard_scenes','POST',{'id':s,'user_id':foreign,'project_id':p,'scene_order':0,'still_prompt':'test','motion_prompt':'test'}).ok
for table in ['video_inspiration_projects','reference_assets','storyboard_scenes','scene_attempts','assembly_jobs']:
 r=req(table+'?user_id=eq.'+foreign,h=user); assert r.ok and r.json()==[],(table,r.status_code)
print('cross-user reads: all five tables hide foreign rows')
r=req('video_inspiration_projects','POST',{'user_id':owner,'title':'Forbidden browser write'},h=user); assert not r.ok
print('browser writes: denied')
req('video_inspiration_projects?id=eq.'+p,'DELETE')
p=str(uuid.uuid4()); s=str(uuid.uuid4()); assert req('video_inspiration_projects','POST',{'id':p,'user_id':owner,'title':'Atomic test'}).ok
assert req('storyboard_scenes','POST',{'id':s,'user_id':owner,'project_id':p,'scene_order':0,'still_prompt':'test','motion_prompt':'test'}).ok
request=str(uuid.uuid4()); payload={'p_user':owner,'p_scene':s,'p_request':request,'p_operation':'still','p_model':'test-no-provider','p_billed':1,'p_workspace':0}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex: results=list(ex.map(lambda _:req('rpc/claim_inspiration_attempt','POST',payload),range(2)))
assert all(r.ok for r in results),[r.text for r in results]
rows=[r.json() for r in results]; assert sum(bool(r.get('claimed')) for r in rows)==1 and sum(bool(r.get('existing')) for r in rows)==1
attempt=rows[0]['attempt']['id']; ledger=req('credit_ledger?attempt_id=eq.'+attempt).json(); assert sum(x['delta'] for x in ledger)==-1
print('duplicate concurrent claims: one claim, same attempt; exactly 1 credit debit')
for _ in range(2): assert req('rpc/fail_inspiration_attempt','POST',{'p_attempt':attempt,'p_reason':'Test failure, no provider call'}).ok
ledger=req('credit_ledger?attempt_id=eq.'+attempt).json(); assert sum(x['delta'] for x in ledger)==0 and sum(x['reason']=='refund_failed' for x in ledger)==1
print('failure refund: twice requested, once returned; net 0 customer credits')
req('storyboard_scenes?id=eq.'+s,'PATCH',{'still_path':owner+'/test.png','approved_at':'2026-11-08T00:00:00Z','approved_revision':1})
state=req('storyboard_scenes?id=eq.'+s).json()[0]; req('storyboard_scenes?id=eq.'+s,'PATCH',{'approved_at':'2026-11-08T00:00:00Z','approved_revision':state['revision']})
assert req('storyboard_scenes?id=eq.'+s,'PATCH',{'motion_prompt':'changed'}).ok
state=req('storyboard_scenes?id=eq.'+s).json()[0]; assert state['approved_at'] is None and state['approved_revision'] is None
print('database prompt edit: approval invalidated')
req('video_inspiration_projects?id=eq.'+p,'DELETE')
