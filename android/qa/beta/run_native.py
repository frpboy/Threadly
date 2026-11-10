"""Run already installed test APK, retaining the exact fenced UID across both cases."""
import os,sys,pathlib,json,subprocess,xml.etree.ElementTree as E
from native_receipt import receipt
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))
from installed_uid import installed_uid

def main():
    root=pathlib.Path.cwd();state=pathlib.Path(sys.argv[1]);mode=sys.argv[2]
    if state.is_symlink() or state.stat().st_mode&0o077:raise ValueError('Unsafe fixture state')
    config=json.loads(state.read_text());uid=os.environ.get('THREADLY_QA_UID','')
    if not uid.isdecimal() or not 10000<=int(uid)<=19999:raise ValueError('Missing exact fenced QA UID')
    classes={'enrollment':'BetaEnrollmentTest','keystore':'DeviceCredentialsTest'}
    expected={'enrollment':'enrollsActualActivityPlaysAndResumesOnOwnedSyntheticServer','keystore':'tokenAndPendingGuessSurviveRecreationWithoutPlaintextPreferences'}
    if mode not in classes:raise ValueError('Unknown mode')
    def adb(*args,seconds=20):
        result=subprocess.run(['adb','-s','emulator-5554',*args],capture_output=True,text=True,timeout=seconds)
        if result.returncode:raise ValueError('Owned emulator command failed')
        return result.stdout
    # Gradle connected tests may uninstall the target. Direct instrumentation never reinstalls.
    actual=installed_uid(adb('shell','cmd','package','list','packages','-U','com.frpboy.threadly.qa'))
    print('Verified live target UID '+str(actual)+'; fenced UID '+uid)
    if str(actual)!=uid:raise ValueError('Target package UID changed; refusing native execution')
    for binary in ['iptables','ip6tables']:
        for rule in [['OUTPUT','-m','owner','--uid-owner',uid,'-j','THREADLY_QA_EGRESS'],['THREADLY_QA_EGRESS','-o','lo','-j','ACCEPT'],['THREADLY_QA_EGRESS','-j','REJECT']]:
            adb('shell',binary,'-C',*rule)
    component='com.frpboy.threadly.qa.test/androidx.test.runner.AndroidJUnitRunner'
    listing=adb('shell','pm','list','instrumentation','com.frpboy.threadly.qa').strip()
    if listing!='instrumentation:'+component+' (target=com.frpboy.threadly.qa)':raise ValueError('Unexpected native runner target')
    cls='app.threadly.game.'+classes[mode]
    command=['shell','am','instrument','-w','-r','-e','class',cls,'-e','qaUid',uid]
    if mode=='enrollment':
        import re
        if not re.fullmatch('[A-Za-z0-9_-]{43}',config['invite']):raise ValueError('Invalid fixture invitation')
        command+=['-e','beta_invitation',config['invite']]
    command.append(component)
    # Capture only; never echo argv or raw status, which could include instrumentation args.
    result=receipt(adb(*command,seconds=240),cls,expected[mode])
    out=root/'beta-evidence';out.mkdir(exist_ok=True)
    proof=E.Element('testsuite',name=classes[mode],tests='1',failures='0',errors='0',skipped='0')
    E.SubElement(proof,'testcase',**result)
    E.ElementTree(proof).write(out/(mode+'.xml'),encoding='utf-8',xml_declaration=True)
    print('PASS exact one '+mode+' native case, same fenced UID, no failure/error/skip; receipt written')
if __name__=='__main__':
    try:main()
    except Exception as error:
        print('Native qualification failed: '+type(error).__name__,file=sys.stderr);sys.exit(1)
