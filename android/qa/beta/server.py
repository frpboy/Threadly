"""Exact owned Next lifecycle and credentials, no production network/database."""
import sys,os,json,pathlib,subprocess,socket,time,urllib.request,urllib.error
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from real_server_gate import guard,ticks,stop

def start(state,beta):
 guard(os.environ)
 state=pathlib.Path(state);beta=pathlib.Path(beta)
 if state.exists() or beta.stat().st_mode&0o077:raise ValueError('unsafe owned state')
 config=json.loads(beta.read_text())
 if config['expires']<=time.time()*1000:raise ValueError('expired fixture')
 env=os.environ.copy();env.update(THREADLY_NATIVE_BETA='isolated-synthetic-only',THREADLY_BETA_SYNTHETIC_ONLY='true',THREADLY_BETA_TARGET_ID=config['target'],THREADLY_BETA_EXPIRES_AT_MS=str(config['expires']))
 with socket.socket() as probe:probe.bind(('127.0.0.1',3189))
 root=pathlib.Path.cwd()
 with state.with_suffix('.log').open('wb') as log:
  p=subprocess.Popen(['node',str(root/'node_modules/next/dist/bin/next'),'start','-H','127.0.0.1','-p','3189'],cwd=root/'apps/web',env=env,stdout=log,stderr=log,start_new_session=True)
 state.write_text(json.dumps({'pid':p.pid,'start_ticks':ticks(p.pid)}));state.chmod(0o600)
 try:
  deadline=time.monotonic()+45
  while time.monotonic()<deadline:
   if p.poll() is not None:raise RuntimeError('Next exited')
   try:urllib.request.urlopen('http://127.0.0.1:3189/api/daily',timeout=2)
   except urllib.error.HTTPError as e:
    if e.code==401:
     if e.headers.get('Cache-Control')!='private, no-store':raise ValueError('missing cache boundary')
     print('PASS actual beta Next ready with unauthorized application401');return
   except OSError:pass
   time.sleep(.3)
  raise TimeoutError('beta Next readiness failed')
 except BaseException:stop(state);raise

if __name__=='__main__':
 if sys.argv[1]=='start':start(sys.argv[2],sys.argv[3])
 elif sys.argv[1]=='stop':stop(sys.argv[2])
 else:raise ValueError('invalid mode')
