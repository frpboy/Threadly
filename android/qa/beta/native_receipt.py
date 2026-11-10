"""Parse AndroidJUnitRunner machine status; never return stdout/credential-bearing data."""
import re

def receipt(text, class_name, test_name):
    blocks=[];fields={};terminal=[]
    for line in text.replace('\r','').splitlines():
        if line.startswith('INSTRUMENTATION_STATUS: '):
            item=line[len('INSTRUMENTATION_STATUS: '):]
            if '=' not in item:raise ValueError('Malformed native status')
            key,value=item.split('=',1)
            if key in fields:raise ValueError('Duplicate native status key')
            fields[key]=value
        elif line.startswith('INSTRUMENTATION_STATUS_CODE: '):
            code=int(line.split(': ',1)[1]);blocks.append((code,fields));fields={}
        elif line.startswith('INSTRUMENTATION_CODE: '):terminal.append(int(line.split(': ',1)[1]))
        elif line.startswith(('INSTRUMENTATION_FAILED:','INSTRUMENTATION_ABORTED:')):raise ValueError('Native runner did not finish')
        elif line.startswith('INSTRUMENTATION_RESULT: ') and any(x in line for x in ['shortMsg=','longMsg=']):raise ValueError('Native runner error')
    if fields or terminal!=[-1] or len(blocks)!=2 or [x[0] for x in blocks]!=[1,0]:raise ValueError('Exact native start/pass discovery mismatch')
    for _,entry in blocks:
        if (entry.get('class'),entry.get('test'),entry.get('numtests'),entry.get('current'))!=(class_name,test_name,'1','1'):raise ValueError('Wrong native test identity/count')
    if len(re.findall(r'^OK \(1 test\)$',text.replace('\r',''),re.M))!=1:raise ValueError('Missing native success summary')
    return {'classname':class_name,'name':test_name}
