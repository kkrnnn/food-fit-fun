"""Read OOXML only; retain authored prompts/options and separate proposed keys."""
import hashlib, json, re, sys
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
source=Path(sys.argv[1]);target=Path(sys.argv[2]);ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with ZipFile(source) as archive:
    root=ET.fromstring(archive.read('word/document.xml'))
    texts=[''.join(p.itertext()) for p in root.findall('.//w:body//w:p',ns)]
keys=['b','b','a','a',None,'a','a','c','a','c','c','b','c','c','b','a','c','a','a','a','a','a','a','a','a','a']
questions=[]
for text in texts:
    number=re.match(r'^\s*(\d+)\.?\s*',text)
    if not number:continue
    n=int(number[1]);body=text[number.end():]
    markers=list(re.finditer(r'(?<!\S)([กขคABC])\.?\s+',body))
    if len(markers)!=3:raise ValueError(f'Expected 3 options for question {n}')
    options=[{'optionId':chr(97+i),'text':body[m.end():markers[i+1].start() if i<2 else len(body)].strip()} for i,m in enumerate(markers)]
    questions.append({'sourceNumber':n,'prompt':body[:markers[0].start()].strip(),'options':options,'proposedCorrectOptionId':keys[n-1],'answerStatus':'needs_revision' if n==5 else 'proposed_not_author_key'})
assert [q['sourceNumber'] for q in questions]==list(range(1,27))
data={'sourceFile':source.name,'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'answerKeyInSource':False,'questions':questions}
target.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Extracted {len(questions)} questions; {sum(q["proposedCorrectOptionId"] is not None for q in questions)} proposed keys')
