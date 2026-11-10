"""No credential in argv logging/XML copy. Target is mandatory fenced loopback QA."""
import os,sys,pathlib,json,subprocess,xml.etree.ElementTree as E,shutil
root=pathlib.Path.cwd();state=pathlib.Path(sys.argv[1]);mode=sys.argv[2]
if state.is_symlink() or state.stat().st_mode&0o077:raise ValueError('Unsafe fixture state')
config=json.loads(state.read_text());uid=os.environ.get('THREADLY_QA_UID','')
if not uid.isdecimal() or int(uid)<10000:raise ValueError('Missing exact fenced QA UID')
classes={'enrollment':'BetaEnrollmentTest','keystore':'DeviceCredentialsTest'}
if mode not in classes:raise ValueError('Unknown mode')
expected={'enrollment':'enrollsActualActivityPlaysAndResumesOnOwnedSyntheticServer','keystore':'tokenAndPendingGuessSurviveRecreationWithoutPlaintextPreferences'}
command=['gradle','--max-workers=2','-Pkotlin.compiler.execution.strategy=in-process','-p','android','-PthreadlyTestBuildType=qa','-Pandroid.testInstrumentationRunnerArguments.qaUid='+uid,'-Pandroid.testInstrumentationRunnerArguments.class=app.threadly.game.'+classes[mode]]
if mode=='enrollment':command.append('-Pandroid.testInstrumentationRunnerArguments.beta_invitation='+config['invite'])
command+=[':app:connectedQaAndroidTest','--no-daemon']
# Remove only this build's owned result directory. A stale XML must never qualify this run.
results=root/'android/app/build/outputs/androidTest-results/connected'
if results.is_symlink():raise ValueError('Unsafe test results directory')
if results.exists():shutil.rmtree(results)
# Runtime-generated synthetic code is masked by seed before this subprocess. Never echo argv.
result=subprocess.run(command,timeout=300)
if result.returncode:raise RuntimeError('Native test command failed')
xmls=list(results.rglob('*.xml'))
cases=[c for p in xmls for c in E.parse(p).getroot().iter('testcase')]
if len(cases)!=1 or cases[0].get('classname')!='app.threadly.game.'+classes[mode] or cases[0].get('name')!=expected[mode] or any(cases[0].find(n) is not None for n in ['failure','error','skipped']):raise ValueError('Exact native discovery mismatch')
out=root/'beta-evidence';out.mkdir(exist_ok=True)
# Copy only a sanitized test receipt. Gradle raw XML might include instrumentation args/stdout.
receipt=E.Element('testsuite',name=classes[mode],tests='1',failures='0',errors='0',skipped='0')
E.SubElement(receipt,'testcase',classname=cases[0].get('classname'),name=cases[0].get('name'),time=cases[0].get('time',''))
E.ElementTree(receipt).write(out/(mode+'.xml'),encoding='utf-8',xml_declaration=True)
print('PASS exact one '+mode+' native case, no failure/error/skip; receipt written')
