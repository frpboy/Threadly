"""Bounded About-only archive. No source tree, raw logs, keys or other build internals."""
from pathlib import Path
import hashlib,json,os,subprocess,tarfile,re,datetime,xml.etree.ElementTree as ET
CAP=20*1024*1024

def stage(root, output):
    root=Path(root).absolute();output=Path(output)
    if output.exists() or root.is_symlink():raise ValueError('Unsafe destination or root')
    selected=[]
    def take(path,name):
        p=root/path
        if not p.is_file() or p.is_symlink() or any(x.is_symlink() for x in p.parents if x==root or root in x.parents):raise ValueError('Missing or linked evidence')
        if p.stat().st_size>CAP-65536 or sum(x.stat().st_size for x,_ in selected)+p.stat().st_size>CAP-65536:raise ValueError('Evidence exceeds cap')
        selected.append((p,name))
    take('android/app/build/outputs/apk/qa/app-qa.apk','app-qa.apk')
    for name in ['about-overview','about-sponsor','about-large-text']:
        take('about-evidence/'+name+'.png',name+'.png')
        with selected[-1][0].open('rb') as f:
            if f.read(8)!=b'\x89PNG\r\n\x1a\n':raise ValueError('Not PNG')
    base=root/'android/app/build/outputs/androidTest-results/connected'
    xml=list(base.rglob('TEST-*.xml'));cases=[]
    if not xml:raise ValueError('Missing XML')
    for i,p in enumerate(sorted(xml)):
        take(str(p.relative_to(root)),f'tests-{i}.xml');cases.extend(ET.parse(p).getroot().iter('testcase'))
    expected={'sponsorNavigationAndLinksStayInsideTheTestHandler','largeTextStillScrollsToVersionAndPackage','returningFromAboutPreservesPendingGuess'}
    if len(cases)!=3 or {c.get('name') for c in cases}!=expected or any(c.get('classname')!='app.threadly.game.AboutScreenTest' or any(c.find(x) is not None for x in ['error','failure','skipped']) for c in cases):raise ValueError('Exact3case discovery required')
    if sum(p.stat().st_size for p,_ in selected)>CAP-65536:raise ValueError('Evidence exceeds cap')
    sha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
    if sha!=os.environ['GITHUB_SHA']:raise ValueError('Source mismatch')
    sdk=Path(os.environ['ANDROID_HOME']).resolve()
    buildtools=sorted((sdk/'build-tools').iterdir(),key=lambda p:tuple(int(x) for x in p.name.split('.')) if re.fullmatch(r'\d+\.\d+\.\d+',p.name) else (0,))
    tools=[p for p in buildtools if (p/'aapt').is_file() and (p/'apksigner').is_file()]
    if not tools:raise ValueError('APK inspection tools missing')
    tools=tools[-1]
    def command(args):return subprocess.check_output([str(a) for a in args],cwd=root,text=True,stderr=subprocess.STDOUT,timeout=30).strip()
    apk=selected[0][0]
    badging=command([tools/'aapt','dump','badging',apk])
    package=re.search(r"^package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'",badging,re.M)
    if not package or package.group(1)!='com.frpboy.threadly.qa':raise ValueError('Wrong APK package')
    signer=command([tools/'apksigner','verify','--verbose','--print-certs',apk])
    digests=re.findall(r'^Signer #\d+ certificate SHA-256 digest: ([0-9a-fA-F]{64})$',signer,re.M)
    if len(digests)!=1:raise ValueError('Expected exactly one APK signing certificate')
    sdkmin=re.search(r"^sdkVersion:'(\d+)'",badging,re.M);sdktarget=re.search(r"^targetSdkVersion:'(\d+)'",badging,re.M)
    if not sdkmin or not sdktarget:raise ValueError('APK SDK metadata missing')
    gradle=command(['gradle','--version']);java=command(['java','-version'])
    if not re.search(r'^Gradle 8\.14\.3$',gradle,re.M):raise ValueError('Unexpected Gradle toolchain')
    manifest={'source_commit':sha,'source_repository':'https://github.com/frpboy/Threadly','channel':'experimental QA only','package':'com.frpboy.threadly.qa','signing':'ephemeral Android debug signer, not production signer','qualification':'3 About UI fixture tests only, not production game/OIDC/native idempotency','version_name':package.group(3),'version_code':int(package.group(2)),'min_sdk':int(sdkmin.group(1)),'target_sdk':int(sdktarget.group(1)),'apk_signer_sha256':digests[0].lower(),'build_date_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'toolchain':{'build_tools':tools.name,'gradle':gradle[:4096],'java':java[:1024]},'build_run':os.environ['GITHUB_SERVER_URL']+'/'+os.environ['GITHUB_REPOSITORY']+'/actions/runs/'+os.environ['GITHUB_RUN_ID'],'files':[{'name':n,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p,n in selected]}
    m=root/'about-evidence/manifest.json';m.write_text(json.dumps(manifest,indent=2));selected.append((m,'manifest.json'))
    with tarfile.open(output,'x:gz') as t:
        for p,n in selected:t.add(p,arcname=n,recursive=False)
    if output.stat().st_size>CAP:output.unlink();raise ValueError('Archive exceeds cap')
    print('Bounded private archive bytes:',output.stat().st_size)
if __name__=='__main__':stage(Path.cwd(),Path(os.environ['RUNNER_TEMP'])/'about-private.tar.gz')
