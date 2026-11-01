import re,sys
P='#lg'
def strip_comments(s): return re.sub(r'/\*.*?\*/','',s,flags=re.S)
def scope_sel(sel):
    out=[]
    for part in split_top(sel,','):
        p=part.strip()
        if not p: continue
        if re.match(r'^(:root|html|body)\b',p):
            p=re.sub(r'^(:root|html|body)(\s+(html|body)\b)?',P,p,count=1)
            out.append(p)
        elif p in('*',):
            out.append(P+' *'); out.append(P)
        else:
            out.append(P+' '+p)
    return ','.join(out)
def split_top(s,ch):
    r=[];d=0;cur=''
    for c in s:
        if c in '([':d+=1
        elif c in ')]':d-=1
        if c==ch and d==0: r.append(cur);cur=''
        else: cur+=c
    r.append(cur);return r
def parse(s,i,scope=True):
    out='';n=len(s)
    while i<n:
        j=i
        # read prelude until { or ; or }
        q=None;start=i
        while i<n:
            c=s[i]
            if q:
                if c==q and s[i-1]!='\\': q=None
            elif c in '"\'': q=c
            elif c in '{;}': break
            i+=1
        pre=s[start:i].strip()
        if i>=n: break
        c=s[i]
        if c=='}': return out,i+1
        if c==';': out+=pre+';';i+=1;continue
        # block
        i+=1
        if pre.startswith('@'):
            kw=pre.split()[0].lower()
            if kw in('@media','@supports','@container','@layer') :
                inner,i=parse(s,i,True); out+=pre+'{'+inner+'}'
            else: # keyframes, font-face, page...
                d=1;st=i
                while d: 
                    if s[i]=='{':d+=1
                    elif s[i]=='}':d-=1
                    i+=1
                out+=pre+'{'+s[st:i]
        else:
            d=1;st=i;q=None
            while d:
                c=s[i]
                if q:
                    if c==q and s[i-1]!='\\': q=None
                elif c in '"\'': q=c
                elif c=='{':d+=1
                elif c=='}':d-=1
                i+=1
            out+=(scope_sel(pre) if scope else pre)+'{'+s[st:i]
    return out,i
css=strip_comments(open(sys.argv[1]).read())
res,_=parse(css,0)
open(sys.argv[2],'w').write(res)
print(len(css),len(res))

# --- đổi tên @keyframes (thêm tiền tố lg-) để không đè animation của web React ---
names=set(re.findall(r'@keyframes\s+([\w-]+)',res))
def ren_anim(m):
    prop,val=m.group(1),m.group(2)
    for n in names: val=re.sub(r'(?<![\w-])'+re.escape(n)+r'(?![\w-])','lg-'+n,val)
    return prop+val
res=re.sub(r'@keyframes\s+([\w-]+)',lambda m:'@keyframes lg-'+m.group(1),res)
res=re.sub(r'(animation(?:-name)?\s*:)([^;}]*)',ren_anim,res)
open(sys.argv[2],'w').write(res)
print('keyframes',len(names))
