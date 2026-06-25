import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import axios from 'axios'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const API_BASE     = import.meta.env.VITE_API_URL || 'https://leadgenengineplatform-api.vercel.app/api'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const ALLOWED_EMAILS = ['aathmaj.riyadh@gmail.com']

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  bg:'#08090a', surface:'#111214', raised:'#161719',
  border:'rgba(255,255,255,0.07)', strong:'rgba(255,255,255,0.12)',
  text:'#f0ede8', muted:'rgba(240,237,232,0.4)', faint:'rgba(240,237,232,0.15)',
  red:'#E7000B', green:'#059669', blue:'#3b82f6', purple:'#7c3aed',
  amber:'#d97706', teal:'#0d9488', pink:'#db2777',
}
const MONO = "'IBM Plex Mono', monospace"
const SANS = "'Host Grotesk', sans-serif"

// ── Style helpers ─────────────────────────────────────────────────────────────
const card  = (extra={}) => ({ background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, ...extra })
const input = (extra={}) => ({ width:'100%', padding:'9px 12px', background:C.raised, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontFamily:MONO, fontSize:12, outline:'none', boxSizing:'border-box', ...extra })
const sel   = (extra={}) => ({ padding:'8px 10px', background:C.raised, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontFamily:MONO, fontSize:11, cursor:'pointer', outline:'none', ...extra })
const btn   = (extra={}) => ({ fontFamily:MONO, fontSize:11, padding:'7px 14px', borderRadius:6, border:`1px solid ${C.border}`, background:'transparent', color:C.muted, cursor:'pointer', whiteSpace:'nowrap', ...extra })
const priBtn= (dis) => ({ fontFamily:SANS, fontWeight:700, fontSize:13, padding:'9px 20px', borderRadius:7, border:'none', background:C.text, color:C.bg, cursor:dis?'not-allowed':'pointer', opacity:dis?0.55:1 })
const redBtn= (extra={}) => ({ fontFamily:MONO, fontSize:11, padding:'6px 12px', borderRadius:6, border:`1px solid rgba(231,0,11,0.3)`, background:'rgba(231,0,11,0.07)', color:C.red, cursor:'pointer', whiteSpace:'nowrap', ...extra })
const toggle= (on) => ({ flexShrink:0, width:40, height:22, borderRadius:11, border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s', background:on?C.green:C.faint })
const knob  = (on) => ({ position:'absolute', top:3, left:on?20:3, width:16, height:16, borderRadius:'50%', background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.4)' })

// ── Tiny components ───────────────────────────────────────────────────────────
const Label = ({children,style={}}) => <p style={{fontFamily:SANS,fontSize:13,fontWeight:600,color:C.text,letterSpacing:'-0.01em',...style}}>{children}</p>
const Sub   = ({children,style={}}) => <p style={{fontFamily:MONO,fontSize:10,color:C.muted,lineHeight:1.5,...style}}>{children}</p>
const SecTitle = ({children}) => <p style={{fontFamily:MONO,fontSize:9,fontWeight:700,letterSpacing:'0.14em',textTransform:'uppercase',color:C.muted,marginBottom:14}}>{children}</p>

function Tag({children,color=C.muted}) {
  return <span style={{fontFamily:MONO,fontSize:9,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase',padding:'2px 7px',background:`${color}18`,border:`1px solid ${color}40`,borderRadius:4,color,whiteSpace:'nowrap'}}>{children}</span>
}

function Flash({msg}) {
  if (!msg?.text) return null
  const ok = msg.ok !== false
  return <div style={{padding:'10px 14px',background:ok?'rgba(5,150,105,0.08)':'rgba(231,0,11,0.08)',border:`1px solid ${ok?'rgba(5,150,105,0.25)':'rgba(231,0,11,0.25)'}`,borderRadius:7,marginTop:12}}>
    <p style={{fontFamily:MONO,fontSize:11,color:ok?C.green:C.red}}>{msg.text}</p>
  </div>
}

function Loader({text='Loading…'}) {
  return <div style={{padding:'40px 0',display:'flex',alignItems:'center',gap:10}}>
    <div style={{width:16,height:16,border:`2px solid ${C.border}`,borderTop:`2px solid ${C.muted}`,borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    <span style={{fontFamily:MONO,fontSize:11,color:C.muted}}>{text}</span>
  </div>
}

function useApi(token) {
  return useCallback((method,path,data) =>
    axios({method,url:`${API_BASE}${path}`,data,headers:{Authorization:`Bearer ${token}`}}), [token])
}
function useFlash(ms=4000) {
  const [msg,setMsg] = useState({text:'',ok:true})
  const flash = useCallback((text,ok=true) => { setMsg({text,ok}); setTimeout(()=>setMsg({text:'',ok:true}),ms) },[ms])
  return [msg,flash]
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({data=[],color=C.green,w=120,h=36}) {
  if (!data.length) return null
  const max = Math.max(...data,1)
  const pts = data.map((v,i)=>{
    const x=(i/Math.max(data.length-1,1))*w, y=h-(v/max)*(h-4)-2
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return <svg width={w} height={h} style={{display:'block'}}>
    <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill={color} fillOpacity="0.1"/>
    <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
  </svg>
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({label,value,sub,color=C.text,spark,sparkColor}) {
  return <div style={card({padding:'16px 20px',display:'flex',flexDirection:'column',gap:6})}>
    <p style={{fontFamily:MONO,fontSize:9,fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase',color:C.muted}}>{label}</p>
    <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:12}}>
      <div>
        <p style={{fontFamily:SANS,fontSize:30,fontWeight:700,color,letterSpacing:'-0.05em',lineHeight:1}}>{value??'—'}</p>
        {sub&&<p style={{fontFamily:MONO,fontSize:10,color:C.muted,marginTop:5}}>{sub}</p>}
      </div>
      {spark&&<Sparkline data={spark} color={sparkColor||color}/>}
    </div>
  </div>
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function SonarLogo({size=26,showLabel=false}) {
  return <div style={{display:'flex',alignItems:'center',gap:10}}>
    <div style={{width:size,height:size,background:C.red,borderRadius:Math.round(size*.25),display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      <svg width={size*.54} height={size*.54} viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="#fff" strokeWidth="1.2" opacity="0.5"/>
        <circle cx="8" cy="8" r="4" stroke="#fff" strokeWidth="1.2" opacity="0.85"/>
        <circle cx="8" cy="8" r="1.5" fill="#fff"/>
        <line x1="9.1" y1="6.9" x2="13" y2="3" stroke="#fff" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    </div>
    {showLabel&&<div>
      <p style={{fontFamily:SANS,fontSize:15,fontWeight:700,color:C.text,letterSpacing:'-0.02em'}}>Sonar Admin</p>
      <p style={{fontFamily:MONO,fontSize:9,color:C.muted,letterSpacing:'0.1em',textTransform:'uppercase'}}>Restricted access</p>
    </div>}
  </div>
}

// ── Growth chart ──────────────────────────────────────────────────────────────
function GrowthChart({growth}) {
  const {days,users,companies,leads} = growth
  if (!days?.length) return null
  const max=Math.max(...(users||[]),...(companies||[]),...(leads||[]),1)
  const W=900,H=140,PAD=32,chartW=W-PAD,chartH=H-20
  const toPoints=arr=>(arr||[]).map((v,i)=>{
    const x=PAD+(i/Math.max((arr.length-1),1))*chartW
    const y=H-14-(v/max)*chartH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const series=[{label:'Users',color:C.blue,pts:toPoints(users)},{label:'Companies',color:C.purple,pts:toPoints(companies)},{label:'Leads',color:C.green,pts:toPoints(leads)}]
  const labelIdxs=(days||[]).map((_,i)=>i).filter(i=>i%5===0||i===days.length-1)
  return <div>
    <div style={{display:'flex',gap:20,marginBottom:14}}>
      {series.map(l=><div key={l.label} style={{display:'flex',alignItems:'center',gap:7}}>
        <span style={{width:22,height:2,background:l.color,display:'inline-block',borderRadius:1}}/>
        <span style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{l.label}</span>
      </div>)}
    </div>
    <div style={{overflowX:'auto'}}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',minWidth:480,height:H,display:'block'}}>
        {[0,.25,.5,.75,1].map(f=>{
          const y=H-14-f*chartH
          return <g key={f}>
            <line x1={PAD} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            <text x={PAD-5} y={y+4} textAnchor="end" fontFamily={MONO} fontSize="8" fill={C.muted}>{Math.round(f*max)}</text>
          </g>
        })}
        {labelIdxs.map(i=><text key={i} x={PAD+(i/Math.max(days.length-1,1))*chartW} y={H-1} textAnchor="middle" fontFamily={MONO} fontSize="8" fill={C.muted}>{(days[i]||'').slice(5)}</text>)}
        {series.map(l=><polyline key={l.label} points={l.pts} fill="none" stroke={l.color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>)}
      </svg>
    </div>
  </div>
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login({onLogin}) {
  const [email,setEmail]=useState(''), [pw,setPw]=useState(''), [loading,setLoading]=useState(false), [err,setErr]=useState('')
  async function handle(e) {
    e.preventDefault(); setLoading(true); setErr('')
    const {data,error}=await supabase.auth.signInWithPassword({email,password:pw})
    if (error){setErr(error.message);setLoading(false);return}
    if (!ALLOWED_EMAILS.includes(data.user?.email)){await supabase.auth.signOut();setErr('Access denied.');setLoading(false);return}
    onLogin(data.user,data.session?.access_token); setLoading(false)
  }
  return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:C.bg}}>
    <div style={card({width:380,padding:'44px 40px',borderRadius:16})}>
      <div style={{marginBottom:28}}><SonarLogo size={30} showLabel/></div>
      <form onSubmit={handle} style={{display:'flex',flexDirection:'column',gap:10}}>
        <input style={input()} type="email" placeholder="your@email.com" value={email} onChange={e=>setEmail(e.target.value)} required autoFocus/>
        <input style={input()} type="password" placeholder="Password" value={pw} onChange={e=>setPw(e.target.value)} required/>
        {err&&<p style={{fontFamily:MONO,fontSize:11,color:C.red,lineHeight:1.4}}>{err}</p>}
        <button type="submit" disabled={loading} style={priBtn(loading)}>{loading?'Verifying…':'Sign in'}</button>
      </form>
      <p style={{fontFamily:MONO,fontSize:10,color:C.muted,marginTop:20,textAlign:'center'}}>Restricted to authorised accounts only</p>
    </div>
  </div>
}

// ── Global search ─────────────────────────────────────────────────────────────
function GlobalSearch({token}) {
  const api=useApi(token)
  const [q,setQ]=useState(''), [results,setResults]=useState(null), [open,setOpen]=useState(false), [loading,setLoading]=useState(false)
  const ref=useRef()
  useEffect(()=>{
    function click(e){if(ref.current&&!ref.current.contains(e.target)){setOpen(false);setQ('')}}
    document.addEventListener('mousedown',click)
    return ()=>document.removeEventListener('mousedown',click)
  },[])
  useEffect(()=>{
    function kd(e){if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setOpen(true);setTimeout(()=>ref.current?.querySelector('input')?.focus(),50)}}
    document.addEventListener('keydown',kd)
    return ()=>document.removeEventListener('keydown',kd)
  },[])
  useEffect(()=>{
    if (q.length<2){setResults(null);return}
    const t=setTimeout(async()=>{
      setLoading(true)
      try{const r=await api('get',`/admin/search?q=${encodeURIComponent(q)}`);setResults(r.data)}catch{}
      setLoading(false)
    },300)
    return ()=>clearTimeout(t)
  },[q])
  const total=(results?.users?.length||0)+(results?.companies?.length||0)+(results?.leads?.length||0)
  return <div ref={ref} style={{position:'relative'}}>
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',background:C.raised,border:`1px solid ${C.border}`,borderRadius:7,cursor:'text',width:220}} onClick={()=>{setOpen(true);setTimeout(()=>ref.current?.querySelector('input')?.focus(),10)}}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      {open
        ? <input value={q} onChange={e=>{setQ(e.target.value);setOpen(true)}} placeholder="Search users, companies, leads…" autoFocus style={{background:'transparent',border:'none',outline:'none',fontFamily:MONO,fontSize:11,color:C.text,width:'100%'}}/>
        : <span style={{fontFamily:MONO,fontSize:11,color:C.muted}}>Search <span style={{padding:'1px 5px',background:C.border,borderRadius:3,fontSize:9}}>⌘K</span></span>
      }
    </div>
    {open&&q.length>=2&&<div style={{position:'absolute',top:'calc(100% + 6px)',left:0,right:0,minWidth:360,background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,boxShadow:'0 20px 60px rgba(0,0,0,0.5)',zIndex:999,overflow:'hidden'}}>
      {loading?<p style={{fontFamily:MONO,fontSize:11,color:C.muted,padding:'14px 16px'}}>Searching…</p>
      :total===0?<p style={{fontFamily:MONO,fontSize:11,color:C.muted,padding:'14px 16px'}}>No results for "{q}"</p>
      :<>
        {results?.users?.length>0&&<div style={{borderBottom:`1px solid ${C.border}`}}>
          <p style={{fontFamily:MONO,fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.faint,padding:'10px 16px 6px'}}>Users</p>
          {results.users.map(u=><div key={u.id} style={{padding:'8px 16px',display:'flex',alignItems:'center',gap:10,cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background=C.raised} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <Tag color={u.role==='admin'||u.role==='owner'?C.red:C.muted}>{u.role}</Tag>
            <div><p style={{fontFamily:SANS,fontSize:12,fontWeight:600,color:C.text}}>{u.full_name||'—'}</p><p style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{u.email}</p></div>
          </div>)}
        </div>}
        {results?.companies?.length>0&&<div style={{borderBottom:`1px solid ${C.border}`}}>
          <p style={{fontFamily:MONO,fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.faint,padding:'10px 16px 6px'}}>Companies</p>
          {results.companies.map(c=><div key={c.id} style={{padding:'8px 16px',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background=C.raised} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <p style={{fontFamily:SANS,fontSize:12,fontWeight:600,color:C.text}}>{c.name}</p>
            {c.domain&&<p style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{c.domain}</p>}
          </div>)}
        </div>}
        {results?.leads?.length>0&&<div>
          <p style={{fontFamily:MONO,fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.faint,padding:'10px 16px 6px'}}>Leads</p>
          {results.leads.map(l=><div key={l.id} style={{padding:'8px 16px',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background=C.raised} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            <p style={{fontFamily:SANS,fontSize:12,fontWeight:600,color:C.text}}>{[l.first_name,l.last_name].filter(Boolean).join(' ')||l.email}</p>
            {l.company&&<p style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{l.company}</p>}
          </div>)}
        </div>}
      </>}
    </div>}
  </div>
}

// ── User Detail Drawer ────────────────────────────────────────────────────────
function UserDrawer({userId,token,onClose}) {
  const api=useApi(token)
  const [data,setData]=useState(null), [loading,setLoading]=useState(true)
  useEffect(()=>{
    if (!userId) return
    api('get',`/admin/user/${userId}`).then(r=>setData(r.data)).catch(()=>{}).finally(()=>setLoading(false))
  },[userId])
  return <>
    <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:200,backdropFilter:'blur(2px)'}}/>
    <div style={{position:'fixed',top:0,right:0,bottom:0,width:460,background:C.surface,borderLeft:`1px solid ${C.border}`,zIndex:201,overflowY:'auto',display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'18px 24px',borderBottom:`1px solid ${C.border}`,position:'sticky',top:0,background:C.surface}}>
        <Label style={{fontSize:15}}>User detail</Label>
        <button onClick={onClose} style={btn()}>✕ Close</button>
      </div>
      {loading?<div style={{padding:24}}><Loader/></div>:!data?<p style={{fontFamily:MONO,fontSize:11,color:C.red,padding:24}}>Failed to load.</p>:<div style={{padding:24,display:'flex',flexDirection:'column',gap:22}}>
        {/* Profile */}
        <div>
          <div style={{width:48,height:48,borderRadius:'50%',background:C.raised,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:MONO,fontSize:18,fontWeight:700,color:C.text,marginBottom:12}}>
            {(data.profile?.full_name||data.profile?.email||'?')[0].toUpperCase()}
          </div>
          <Label style={{fontSize:16}}>{data.profile?.full_name||'—'}</Label>
          <Sub style={{marginTop:3}}>{data.profile?.email}</Sub>
          <div style={{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}}>
            <Tag color={data.profile?.role==='admin'||data.profile?.role==='owner'?C.red:C.muted}>{data.profile?.role||'member'}</Tag>
            <Tag color={data.profile?.suspended?C.amber:C.green}>{data.profile?.suspended?'suspended':'active'}</Tag>
          </div>
        </div>
        {/* Auth info */}
        <div style={card({padding:'14px 16px'})}>
          <SecTitle>Auth</SecTitle>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {[['Last sign in',data.auth?.last_sign_in?.slice(0,16)||'Never'],['Joined',(data.profile?.created_at||'').slice(0,10)],['Email confirmed',data.auth?.email_confirmed?'Yes':'No'],['Suspended',data.profile?.suspended?'Yes':'No']].map(([k,v])=><div key={k}>
              <Sub style={{marginBottom:3}}>{k}</Sub>
              <p style={{fontFamily:MONO,fontSize:11,color:C.text}}>{v}</p>
            </div>)}
          </div>
        </div>
        {/* Counts */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {Object.entries(data.counts||{}).map(([k,v])=><div key={k} style={card({padding:'10px 14px',textAlign:'center'})}>
            <p style={{fontFamily:SANS,fontSize:20,fontWeight:700,color:C.text,letterSpacing:'-0.04em'}}>{v}</p>
            <Sub style={{marginTop:3,textTransform:'capitalize'}}>{k}</Sub>
          </div>)}
        </div>
        {/* Recent companies */}
        {data.recent_companies?.length>0&&<div>
          <SecTitle>Recent companies</SecTitle>
          <div style={card({overflow:'hidden'})}>
            {data.recent_companies.map((c,i)=><div key={c.id} style={{padding:'9px 14px',borderBottom:i<data.recent_companies.length-1?`1px solid ${C.border}`:'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><p style={{fontFamily:SANS,fontSize:12,fontWeight:600,color:C.text}}>{c.name}</p>{c.domain&&<Sub>{c.domain}</Sub>}</div>
              <Sub>{c.created_at?.slice(0,10)}</Sub>
            </div>)}
          </div>
        </div>}
        {/* Recent leads */}
        {data.recent_leads?.length>0&&<div>
          <SecTitle>Recent leads</SecTitle>
          <div style={card({overflow:'hidden'})}>
            {data.recent_leads.map((l,i)=><div key={l.id} style={{padding:'9px 14px',borderBottom:i<data.recent_leads.length-1?`1px solid ${C.border}`:'none',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><p style={{fontFamily:SANS,fontSize:12,fontWeight:600,color:C.text}}>{[l.first_name,l.last_name].filter(Boolean).join(' ')||l.email}</p>{l.company&&<Sub>{l.company}</Sub>}</div>
              <Sub>{l.created_at?.slice(0,10)}</Sub>
            </div>)}
          </div>
        </div>}
        {/* Recent sequences */}
        {data.recent_sequences?.length>0&&<div>
          <SecTitle>Sequences</SecTitle>
          <div style={card({overflow:'hidden'})}>
            {data.recent_sequences.map((s,i)=><div key={s.id} style={{padding:'9px 14px',borderBottom:i<data.recent_sequences.length-1?`1px solid ${C.border}`:'none',display:'flex',justifyContent:'space-between'}}>
              <p style={{fontFamily:SANS,fontSize:12,color:C.text}}>{s.name}</p>
              <Sub>{s.created_at?.slice(0,10)}</Sub>
            </div>)}
          </div>
        </div>}
      </div>}
    </div>
  </>
}

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({token}) {
  const api=useApi(token)
  const [stats,setStats]=useState(null), [growth,setGrowth]=useState(null), [eng,setEng]=useState(null), [loading,setLoading]=useState(true)
  const [search,setSearch]=useState(''), [drawer,setDrawer]=useState(null)
  useEffect(()=>{
    Promise.all([
      api('get','/admin/stats').then(r=>setStats(r.data)),
      api('get','/admin/growth').then(r=>setGrowth(r.data)).catch(()=>{}),
      api('get','/admin/engagement').then(r=>setEng(r.data)).catch(()=>{}),
    ]).catch(()=>{}).finally(()=>setLoading(false))
  },[])
  if (loading) return <Loader/>
  if (!stats) return <p style={{fontFamily:MONO,fontSize:11,color:C.red}}>Failed to load stats.</p>
  const st=stats.stats
  const filtered=(stats.recent_users||[]).filter(u=>!search||(u.email||'').toLowerCase().includes(search.toLowerCase())||(u.name||'').toLowerCase().includes(search.toLowerCase()))
  return <div style={{display:'flex',flexDirection:'column',gap:32}}>
    {drawer&&<UserDrawer userId={drawer} token={token} onClose={()=>setDrawer(null)}/>}
    <div>
      <SecTitle>Platform at a glance</SecTitle>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(190px,1fr))',gap:10}}>
        <StatCard label="Total users"     value={st.users.total}     sub={`+${st.users.last_7d} this week`}     color={C.blue}   spark={growth?.users}     sparkColor={C.blue}/>
        <StatCard label="Total companies" value={st.companies.total} sub={`+${st.companies.last_7d} this week`} color={C.purple} spark={growth?.companies} sparkColor={C.purple}/>
        <StatCard label="Total leads"     value={st.leads.total}     sub={`+${st.leads.last_7d} this week`}     color={C.green}  spark={growth?.leads}     sparkColor={C.green}/>
        <StatCard label="DAU"  value={eng?.dau??'—'} sub="active today"     color={C.teal}/>
        <StatCard label="WAU"  value={eng?.wau??'—'} sub="active this week" color={C.teal}/>
        <StatCard label="MAU"  value={eng?.mau??'—'} sub="active this month"color={C.teal}/>
        <StatCard label="Inactive 30d" value={eng?.inactive_count??'—'} color={C.amber}/>
      </div>
    </div>
    {growth&&<div>
      <SecTitle>30-day growth</SecTitle>
      <div style={card({padding:'20px 24px'})}><GrowthChart growth={growth}/></div>
    </div>}
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <SecTitle>Recent users ({stats.recent_users?.length})</SecTitle>
        <input style={input({width:220,padding:'6px 10px',fontSize:11})} placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>
      <div style={card({overflow:'hidden'})}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 80px 70px 80px 80px 90px',padding:'8px 16px',borderBottom:`1px solid ${C.border}`}}>
          {['User','Cos','Leads','Role','Status','Joined'].map(h=><span key={h} style={{fontFamily:MONO,fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.faint}}>{h}</span>)}
        </div>
        {filtered.map((u,i)=><div key={u.id} onClick={()=>setDrawer(u.id)} style={{display:'grid',gridTemplateColumns:'1fr 80px 70px 80px 80px 90px',padding:'11px 16px',borderBottom:i<filtered.length-1?`1px solid ${C.border}`:'none',alignItems:'center',cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background=C.raised} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
          <div><p style={{fontFamily:SANS,fontSize:12,fontWeight:600,color:C.text}}>{u.name||'—'}</p><p style={{fontFamily:MONO,fontSize:10,color:C.muted,marginTop:2}}>{u.email}</p></div>
          <span style={{fontFamily:MONO,fontSize:12,color:(u.companies||0)>0?C.text:C.muted}}>{u.companies??0}</span>
          <span style={{fontFamily:MONO,fontSize:12,color:(u.leads||0)>0?C.text:C.muted}}>{u.leads??0}</span>
          <Tag color={u.role==='admin'||u.role==='owner'?C.red:C.muted}>{u.role}</Tag>
          <Tag color={u.suspended?C.amber:C.green}>{u.suspended?'suspended':'active'}</Tag>
          <span style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{(u.joined||'').slice(0,10)}</span>
        </div>)}
      </div>
    </div>
  </div>
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function Analytics({token}) {
  const api=useApi(token)
  const [eng,setEng]=useState(null), [adoption,setAdoption]=useState(null), [retention,setRetention]=useState(null), [loading,setLoading]=useState(true)
  const [topMode,setTopMode]=useState('companies')
  useEffect(()=>{
    Promise.all([
      api('get','/admin/engagement').then(r=>setEng(r.data)).catch(()=>{}),
      api('get','/admin/feature-adoption').then(r=>setAdoption(r.data)).catch(()=>{}),
      api('get','/admin/retention').then(r=>setRetention(r.data)).catch(()=>{}),
    ]).catch(()=>{}).finally(()=>setLoading(false))
  },[])
  if (loading) return <Loader/>
  const topUsers=topMode==='companies'?eng?.top_by_companies:eng?.top_by_leads
  return <div style={{display:'flex',flexDirection:'column',gap:32}}>
    {/* DAU/WAU/MAU */}
    <div>
      <SecTitle>Active users</SecTitle>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        <StatCard label="DAU"  value={eng?.dau??'—'} sub="unique users today"       color={C.teal}/>
        <StatCard label="WAU"  value={eng?.wau??'—'} sub="unique users this week"   color={C.teal}/>
        <StatCard label="MAU"  value={eng?.mau??'—'} sub="unique users this month"  color={C.teal}/>
        <StatCard label="Inactive" value={eng?.inactive_count??'—'} sub=">30 days no sign-in" color={C.amber}/>
      </div>
    </div>
    {/* Feature adoption */}
    {adoption&&<div>
      <SecTitle>Feature adoption ({adoption.total_users} total users)</SecTitle>
      <div style={card({padding:'20px 24px',display:'flex',flexDirection:'column',gap:14})}>
        {adoption.features.map(f=><div key={f.name}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
            <p style={{fontFamily:SANS,fontSize:13,fontWeight:600,color:C.text}}>{f.name}</p>
            <div style={{display:'flex',gap:12,alignItems:'center'}}>
              <span style={{fontFamily:MONO,fontSize:11,color:C.muted}}>{f.users_adopted} users</span>
              <span style={{fontFamily:MONO,fontSize:12,fontWeight:700,color:f.adoption_pct>50?C.green:f.adoption_pct>20?C.amber:C.muted}}>{f.adoption_pct}%</span>
            </div>
          </div>
          <div style={{height:6,background:C.raised,borderRadius:3,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${f.adoption_pct}%`,background:f.adoption_pct>50?C.green:f.adoption_pct>20?C.amber:C.muted,borderRadius:3,transition:'width 0.6s ease'}}/>
          </div>
          <p style={{fontFamily:MONO,fontSize:9,color:C.faint,marginTop:4}}>{f.total} total records</p>
        </div>)}
      </div>
    </div>}
    {/* Retention cohort */}
    {retention&&<div>
      <SecTitle>8-week retention cohort</SecTitle>
      <div style={card({overflow:'hidden'})}>
        <div style={{display:'grid',gridTemplateColumns:'80px 70px 80px 80px 1fr',padding:'8px 16px',borderBottom:`1px solid ${C.border}`}}>
          {['Week','Size','Retained','Returned','Retention %'].map(h=><span key={h} style={{fontFamily:MONO,fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.faint}}>{h}</span>)}
        </div>
        {retention.cohorts.map((c,i)=>{
          const pct=c.retention_pct; const color=pct>=50?C.green:pct>=20?C.amber:C.red
          return <div key={i} style={{display:'grid',gridTemplateColumns:'80px 70px 80px 80px 1fr',padding:'10px 16px',borderBottom:i<retention.cohorts.length-1?`1px solid ${C.border}`:'none',alignItems:'center'}}>
            <span style={{fontFamily:MONO,fontSize:11,color:C.text}}>{c.week}</span>
            <span style={{fontFamily:MONO,fontSize:11,color:C.muted}}>{c.size}</span>
            <span style={{fontFamily:MONO,fontSize:11,color:C.text}}>{c.retained}</span>
            <span style={{fontFamily:MONO,fontSize:11,color:C.muted}}>{c.returned}</span>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,height:6,background:C.raised,borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:3}}/>
              </div>
              <span style={{fontFamily:MONO,fontSize:11,fontWeight:700,color,minWidth:38,textAlign:'right'}}>{pct}%</span>
            </div>
          </div>
        })}
      </div>
    </div>}
    {/* Top users */}
    {eng&&<div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
        <SecTitle>Top users</SecTitle>
        <div style={{display:'flex',gap:6}}>
          {['companies','leads'].map(m=><button key={m} onClick={()=>setTopMode(m)} style={{fontFamily:MONO,fontSize:10,padding:'5px 12px',borderRadius:5,border:`1px solid ${topMode===m?C.strong:C.border}`,background:topMode===m?'rgba(255,255,255,0.06)':'transparent',color:topMode===m?C.text:C.muted,cursor:'pointer',textTransform:'capitalize'}}>{m}</button>)}
        </div>
      </div>
      <div style={card({overflow:'hidden'})}>
        {(topUsers||[]).filter(u=>(u[topMode]||0)>0).slice(0,8).map((u,i)=><div key={u.id} style={{display:'flex',alignItems:'center',padding:'10px 16px',borderBottom:i<7?`1px solid ${C.border}`:'none',gap:14}}>
          <span style={{fontFamily:MONO,fontSize:12,color:C.faint,width:20,textAlign:'right'}}>{i+1}</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{fontFamily:SANS,fontSize:12,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.full_name||'—'}</p>
            <p style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{u.email}</p>
          </div>
          <div style={{display:'flex',gap:16,textAlign:'right'}}>
            <div><p style={{fontFamily:MONO,fontSize:13,fontWeight:700,color:topMode==='companies'?C.purple:C.muted}}>{u.companies}</p><Sub>cos</Sub></div>
            <div><p style={{fontFamily:MONO,fontSize:13,fontWeight:700,color:topMode==='leads'?C.green:C.muted}}>{u.leads}</p><Sub>leads</Sub></div>
          </div>
        </div>)}
      </div>
    </div>}
  </div>
}

// ── Users ─────────────────────────────────────────────────────────────────────
function Users({token}) {
  const api=useApi(token)
  const [users,setUsers]=useState([]), [total,setTotal]=useState(0), [page,setPage]=useState(0)
  const [search,setSearch]=useState(''), [roleFilter,setRoleFilter]=useState(''), [inactiveOnly,setInactiveOnly]=useState(false)
  const [loading,setLoading]=useState(true), [msg,flash]=useFlash(), [drawer,setDrawer]=useState(null)

  const load=useCallback(async(p,s,r)=>{
    setLoading(true)
    try{const res=await api('get',`/admin/all-users?page=${p}&search=${encodeURIComponent(s)}&role=${r}`);setUsers(res.data.users||[]);setTotal(res.data.total||0)}catch{}
    setLoading(false)
  },[api])
  useEffect(()=>{load(0,search,roleFilter)},[search,roleFilter])

  async function exportCSV(){
    try{
      const resp=await axios.get(`${API_BASE}/admin/export/users`,{headers:{Authorization:`Bearer ${token}`},responseType:'blob'})
      const url=URL.createObjectURL(resp.data), a=document.createElement('a'); a.href=url; a.download='sonar-users.csv'; a.click(); URL.revokeObjectURL(url)
    }catch{flash('Export failed',false)}
  }

  async function toggleSuspend(u){
    try{await api('patch',`/admin/users/${u.id}`,{suspended:!u.suspended});flash(`${u.email} ${!u.suspended?'suspended':'reactivated'}`);load(page,search,roleFilter)}
    catch(e){flash(e?.response?.data?.detail||'Failed',false)}
  }
  async function changeRole(u,role){
    try{await api('patch',`/admin/users/${u.id}`,{role});setUsers(prev=>prev.map(x=>x.id===u.id?{...x,role}:x));flash(`${u.email} → ${role}`)}
    catch(e){flash(e?.response?.data?.detail||'Failed',false)}
  }
  async function del(u){
    if(!confirm(`Permanently delete ${u.email}?`))return
    try{await api('delete',`/admin/users/${u.id}`);flash(`${u.email} deleted`);setUsers(prev=>prev.filter(x=>x.id!==u.id))}
    catch(e){flash(e?.response?.data?.detail||'Failed',false)}
  }

  const displayed=inactiveOnly?users.filter(u=>u.suspended):users
  const pages=Math.ceil(total/50)

  return <div style={{display:'flex',flexDirection:'column',gap:20}}>
    {drawer&&<UserDrawer userId={drawer} token={token} onClose={()=>setDrawer(null)}/>}
    <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
      <input style={input({width:260,padding:'8px 12px'})} placeholder="Search by name or email…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/>
      <select style={sel()} value={roleFilter} onChange={e=>{setRoleFilter(e.target.value);setPage(0)}}>
        <option value="">All roles</option>
        <option value="member">member</option>
        <option value="admin">admin</option>
        <option value="owner">owner</option>
      </select>
      <label style={{display:'flex',alignItems:'center',gap:7,cursor:'pointer',fontFamily:MONO,fontSize:11,color:C.muted}}>
        <input type="checkbox" checked={inactiveOnly} onChange={e=>setInactiveOnly(e.target.checked)} style={{accentColor:C.amber}}/>
        Suspended only
      </label>
      <span style={{fontFamily:MONO,fontSize:11,color:C.muted,marginLeft:'auto'}}>{total} total</span>
      <button onClick={exportCSV} style={btn()}>↓ Export CSV</button>
    </div>
    <Flash msg={msg}/>
    <div style={card({overflow:'hidden'})}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 70px 70px 100px 80px 80px 170px',padding:'9px 16px',borderBottom:`1px solid ${C.border}`}}>
        {['User','Cos','Leads','Role','Status','Joined','Actions'].map(h=><span key={h} style={{fontFamily:MONO,fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.faint}}>{h}</span>)}
      </div>
      {loading?<div style={{padding:24}}><Loader/></div>
      :displayed.length===0?<p style={{fontFamily:MONO,fontSize:10,color:C.muted,padding:'24px 16px'}}>No users found.</p>
      :displayed.map((u,i)=><div key={u.id} style={{display:'grid',gridTemplateColumns:'1fr 70px 70px 100px 80px 80px 170px',padding:'10px 16px',borderBottom:i<displayed.length-1?`1px solid ${C.border}`:'none',alignItems:'center'}}>
        <div style={{minWidth:0,cursor:'pointer'}} onClick={()=>setDrawer(u.id)}>
          <p style={{fontFamily:SANS,fontSize:12,fontWeight:600,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.full_name||'—'}</p>
          <p style={{fontFamily:MONO,fontSize:10,color:C.muted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.email}</p>
        </div>
        <span style={{fontFamily:MONO,fontSize:12,color:(u.companies||0)>0?C.text:C.muted}}>{u.companies??0}</span>
        <span style={{fontFamily:MONO,fontSize:12,color:(u.leads||0)>0?C.text:C.muted}}>{u.leads??0}</span>
        <select style={sel({padding:'4px 6px',fontSize:10})} value={u.role} onChange={e=>changeRole(u,e.target.value)}>
          <option value="member">member</option>
          <option value="admin">admin</option>
          <option value="owner">owner</option>
        </select>
        <Tag color={u.suspended?C.amber:C.green}>{u.suspended?'suspended':'active'}</Tag>
        <span style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{(u.created_at||'').slice(0,10)}</span>
        <div style={{display:'flex',gap:5}}>
          <button onClick={()=>setDrawer(u.id)} style={btn({fontSize:10,padding:'4px 8px'})}>View</button>
          <button onClick={()=>toggleSuspend(u)} style={btn({fontSize:10,padding:'4px 8px',color:u.suspended?C.green:C.amber,borderColor:u.suspended?'rgba(5,150,105,0.3)':'rgba(217,119,6,0.3)'})}>
            {u.suspended?'Activate':'Suspend'}
          </button>
          <button onClick={()=>del(u)} style={redBtn({padding:'4px 8px',fontSize:10})}>Del</button>
        </div>
      </div>)}
    </div>
    {pages>1&&<div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'center'}}>
      <button style={btn()} disabled={page===0} onClick={()=>{const p=page-1;setPage(p);load(p,search,roleFilter)}}>← Prev</button>
      <span style={{fontFamily:MONO,fontSize:11,color:C.muted}}>Page {page+1}/{pages}</span>
      <button style={btn()} disabled={page>=pages-1} onClick={()=>{const p=page+1;setPage(p);load(p,search,roleFilter)}}>Next →</button>
    </div>}
  </div>
}

// ── Comms (Announcements + Email Blast) ───────────────────────────────────────
function Comms({token}) {
  const api=useApi(token)
  const [mode,setMode]=useState('announcements')
  const [list,setList]=useState([]), [listLoading,setListLoading]=useState(true)
  const [annMsg,annFlash]=useFlash(), [blastMsg,blastFlash]=useFlash()
  const [annTitle,setAnnTitle]=useState(''), [annBody,setAnnBody]=useState(''), [annKind,setAnnKind]=useState('info'), [annSub,setAnnSub]=useState(false)
  const [blastSubject,setBlastSubject]=useState(''), [blastBody,setBlastBody]=useState(''), [blastSegment,setBlastSegment]=useState('all'), [blastSub,setBlastSub]=useState(false), [blastResult,setBlastResult]=useState(null)

  const kindColors={info:C.blue,warning:C.amber,success:C.green,error:C.red}

  const loadList=useCallback(async()=>{
    try{const r=await api('get','/admin/announcements');setList(r.data||[])}catch{} finally{setListLoading(false)}
  },[api])
  useEffect(()=>{loadList()},[])

  async function handleAnn(e){
    e.preventDefault(); setAnnSub(true)
    try{await api('post','/admin/announcements',{title:annTitle,body:annBody,kind:annKind});annFlash('Published');setAnnTitle('');setAnnBody('');setAnnKind('info');loadList()}
    catch(err){annFlash(err?.response?.data?.detail||'Failed',false)}
    setAnnSub(false)
  }
  async function toggleAnn(item){
    try{await api('patch',`/admin/announcements/${item.id}`,{active:!item.active});setList(prev=>prev.map(x=>x.id===item.id?{...x,active:!x.active}:x))}catch{}
  }
  async function delAnn(id){
    if(!confirm('Delete?'))return
    try{await api('delete',`/admin/announcements/${id}`);setList(prev=>prev.filter(x=>x.id!==id))}catch{}
  }
  async function handleBlast(e){
    e.preventDefault(); setBlastSub(true); setBlastResult(null)
    try{const r=await api('post','/admin/email-blast',{subject:blastSubject,body:blastBody,segment:blastSegment});setBlastResult(r.data);blastFlash(`Sent to ${r.data.sent} recipients`)}
    catch(err){blastFlash(err?.response?.data?.detail||'Failed',false)}
    setBlastSub(false)
  }

  const tabBtns=[['announcements','Announcements'],['blast','Email Blast']]
  return <div style={{display:'flex',flexDirection:'column',gap:28}}>
    <div style={{display:'flex',gap:6}}>{tabBtns.map(([id,label])=><button key={id} onClick={()=>setMode(id)} style={btn({color:mode===id?C.text:C.muted,borderColor:mode===id?C.strong:C.border,background:mode===id?'rgba(255,255,255,0.06)':'transparent'})}>{label}</button>)}</div>

    {mode==='announcements'&&<>
      <div style={card({overflow:'hidden'})}>
        <div style={{padding:'18px 22px',borderBottom:`1px solid ${C.border}`}}>
          <Label style={{fontSize:15}}>New announcement</Label>
          <Sub style={{marginTop:3}}>Publish a banner visible to all users on the main platform.</Sub>
        </div>
        <form onSubmit={handleAnn} style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',gap:10}}>
            <div style={{flex:1}}><Sub style={{marginBottom:5}}>Title *</Sub><input style={input()} placeholder="e.g. Scheduled maintenance on June 30" value={annTitle} onChange={e=>setAnnTitle(e.target.value)} required/></div>
            <div><Sub style={{marginBottom:5}}>Type</Sub><select style={sel({height:38})} value={annKind} onChange={e=>setAnnKind(e.target.value)}><option value="info">ℹ info</option><option value="warning">⚠ warning</option><option value="success">✓ success</option><option value="error">✕ error</option></select></div>
          </div>
          <div><Sub style={{marginBottom:5}}>Body (optional)</Sub><textarea style={input({height:72,resize:'vertical',lineHeight:1.5})} placeholder="Additional details…" value={annBody} onChange={e=>setAnnBody(e.target.value)}/></div>
          <div style={{display:'flex',alignItems:'center',gap:14}}>
            <button type="submit" disabled={annSub} style={priBtn(annSub)}>{annSub?'Publishing…':'Publish'}</button>
            {annTitle&&<div style={{flex:1,padding:'8px 14px',borderRadius:7,border:`1px solid ${(kindColors[annKind]||C.blue)}40`,background:`${kindColors[annKind]||C.blue}0c`}}>
              <p style={{fontFamily:SANS,fontSize:12,fontWeight:600,color:kindColors[annKind]||C.blue}}>{annTitle}</p>
              {annBody&&<p style={{fontFamily:SANS,fontSize:11,color:C.muted,marginTop:3}}>{annBody}</p>}
            </div>}
          </div>
          <Flash msg={annMsg}/>
        </form>
      </div>
      <div>
        <SecTitle>All announcements ({list.length})</SecTitle>
        {listLoading?<Loader/>:list.length===0?<p style={{fontFamily:MONO,fontSize:10,color:C.muted}}>No announcements yet.</p>
        :<div style={{display:'flex',flexDirection:'column',gap:8}}>
          {list.map(item=>{const kc=kindColors[item.kind]||C.blue; return <div key={item.id} style={card({padding:'14px 18px',display:'flex',alignItems:'flex-start',gap:16,opacity:item.active?1:0.5,borderColor:item.active?`${kc}30`:C.border})}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}><Tag color={kc}>{item.kind}</Tag><Label style={{fontSize:13}}>{item.title}</Label></div>
              {item.body&&<p style={{fontFamily:SANS,fontSize:12,color:C.muted,lineHeight:1.5}}>{item.body}</p>}
              <Sub style={{marginTop:6}}>{(item.created_at||'').slice(0,10)}</Sub>
            </div>
            <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
              <button onClick={()=>toggleAnn(item)} style={toggle(item.active)}><span style={knob(item.active)}/></button>
              <button onClick={()=>delAnn(item.id)} style={redBtn()}>Delete</button>
            </div>
          </div>})}
        </div>}
      </div>
    </>}

    {mode==='blast'&&<>
      <div style={{background:'rgba(231,0,11,0.05)',border:`1px solid rgba(231,0,11,0.2)`,borderRadius:8,padding:'12px 16px'}}>
        <p style={{fontFamily:MONO,fontSize:11,color:C.red,lineHeight:1.5}}>⚠ Email blast sends to real users. Double-check your subject and body before sending. Capped at 500 recipients per blast.</p>
      </div>
      <div style={card({overflow:'hidden'})}>
        <div style={{padding:'18px 22px',borderBottom:`1px solid ${C.border}`}}>
          <Label style={{fontSize:15}}>Email blast</Label>
          <Sub style={{marginTop:3}}>Send an email directly to a segment of your users via Resend.</Sub>
        </div>
        <form onSubmit={handleBlast} style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',gap:10}}>
            <div style={{flex:1}}><Sub style={{marginBottom:5}}>Subject *</Sub><input style={input()} placeholder="What's new in Sonar this week" value={blastSubject} onChange={e=>setBlastSubject(e.target.value)} required/></div>
            <div><Sub style={{marginBottom:5}}>Segment</Sub>
              <select style={sel({height:38})} value={blastSegment} onChange={e=>setBlastSegment(e.target.value)}>
                <option value="all">All users</option>
                <option value="active">Active (last 30d)</option>
                <option value="inactive">Inactive (>30d)</option>
              </select>
            </div>
          </div>
          <div><Sub style={{marginBottom:5}}>Body *</Sub><textarea style={input({height:140,resize:'vertical',lineHeight:1.6})} placeholder="Write your email body here. Plain text — line breaks become paragraphs." value={blastBody} onChange={e=>setBlastBody(e.target.value)} required/></div>
          <button type="submit" disabled={blastSub} style={priBtn(blastSub)}>{blastSub?'Sending…':'Send blast'}</button>
          <Flash msg={blastMsg}/>
          {blastResult&&<div style={card({padding:'14px 18px'})}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
              {[['Sent',blastResult.sent,C.green],['Errors',blastResult.errors,blastResult.errors>0?C.red:C.muted],['Total',blastResult.total,C.muted]].map(([l,v,c])=><div key={l}><Sub style={{marginBottom:3}}>{l}</Sub><p style={{fontFamily:MONO,fontSize:18,fontWeight:700,color:c}}>{v}</p></div>)}
            </div>
          </div>}
        </form>
      </div>
    </>}
  </div>
}

// ── Changelog ─────────────────────────────────────────────────────────────────
function Changelog({token}) {
  const api=useApi(token)
  const [list,setList]=useState([]), [loading,setLoading]=useState(true), [submitting,setSubmitting]=useState(false)
  const [msg,flash]=useFlash()
  const [title,setTitle]=useState(''), [body,setBody]=useState(''), [version,setVersion]=useState(''), [published,setPublished]=useState(true)
  const [editing,setEditing]=useState(null)

  const load=useCallback(async()=>{
    try{const r=await api('get','/admin/changelog');setList(r.data||[])}catch{}finally{setLoading(false)}
  },[api])
  useEffect(()=>{load()},[])

  async function handleSave(e){
    e.preventDefault(); setSubmitting(true)
    try{
      if (editing){await api('patch',`/admin/changelog/${editing.id}`,{title,body,version,published});flash('Updated')}
      else{await api('post','/admin/changelog',{title,body,version,published});flash('Published')}
      setTitle('');setBody('');setVersion('');setPublished(true);setEditing(null);load()
    }catch(err){flash(err?.response?.data?.detail||'Failed',false)}
    setSubmitting(false)
  }
  function startEdit(item){setEditing(item);setTitle(item.title);setBody(item.body||'');setVersion(item.version||'');setPublished(item.published)}
  async function del(id){if(!confirm('Delete?'))return;try{await api('delete',`/admin/changelog/${id}`);setList(prev=>prev.filter(x=>x.id!==id))}catch{flash('Failed',false)}}

  return <div style={{display:'flex',flexDirection:'column',gap:28}}>
    <div style={card({overflow:'hidden'})}>
      <div style={{padding:'18px 22px',borderBottom:`1px solid ${C.border}`}}>
        <Label style={{fontSize:15}}>{editing?'Edit entry':'New entry'}</Label>
        <Sub style={{marginTop:3}}>Release notes shown to users inside the main app.</Sub>
      </div>
      <form onSubmit={handleSave} style={{padding:'20px 22px',display:'flex',flexDirection:'column',gap:12}}>
        <div style={{display:'flex',gap:10}}>
          <div style={{flex:1}}><Sub style={{marginBottom:5}}>Title *</Sub><input style={input()} placeholder="What shipped?" value={title} onChange={e=>setTitle(e.target.value)} required/></div>
          <div style={{width:120}}><Sub style={{marginBottom:5}}>Version</Sub><input style={input()} placeholder="v1.4.0" value={version} onChange={e=>setVersion(e.target.value)}/></div>
        </div>
        <div><Sub style={{marginBottom:5}}>Description</Sub><textarea style={input({height:100,resize:'vertical',lineHeight:1.6})} placeholder="What's new, improved, or fixed…" value={body} onChange={e=>setBody(e.target.value)}/></div>
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          <button type="submit" disabled={submitting} style={priBtn(submitting)}>{submitting?(editing?'Saving…':'Publishing…'):(editing?'Save changes':'Publish')}</button>
          <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontFamily:MONO,fontSize:11,color:C.muted}}>
            <input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)} style={{accentColor:C.green}}/>
            Published (visible to users)
          </label>
          {editing&&<button type="button" onClick={()=>{setEditing(null);setTitle('');setBody('');setVersion('');setPublished(true)}} style={btn()}>Cancel</button>}
        </div>
        <Flash msg={msg}/>
      </form>
    </div>
    <div>
      <SecTitle>All entries ({list.length})</SecTitle>
      {loading?<Loader/>:list.length===0?<p style={{fontFamily:MONO,fontSize:10,color:C.muted}}>No entries yet.</p>
      :<div style={{display:'flex',flexDirection:'column',gap:8}}>
        {list.map(item=><div key={item.id} style={card({padding:'16px 20px',opacity:item.published?1:0.55})}>
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                {item.version&&<Tag color={C.blue}>{item.version}</Tag>}
                <Tag color={item.published?C.green:C.muted}>{item.published?'published':'draft'}</Tag>
                <Sub>{(item.created_at||'').slice(0,10)}</Sub>
              </div>
              <Label style={{fontSize:14,marginBottom:4}}>{item.title}</Label>
              {item.body&&<p style={{fontFamily:SANS,fontSize:12,color:C.muted,lineHeight:1.6,marginTop:4}}>{item.body}</p>}
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              <button onClick={()=>startEdit(item)} style={btn({fontSize:10,padding:'5px 10px'})}>Edit</button>
              <button onClick={()=>del(item.id)} style={redBtn({padding:'5px 10px',fontSize:10})}>Delete</button>
            </div>
          </div>
        </div>)}
      </div>}
    </div>
  </div>
}

// ── System Health ─────────────────────────────────────────────────────────────
function SystemHealth({token}) {
  const api=useApi(token)
  const [data,setData]=useState(null), [loading,setLoading]=useState(true), [refreshing,setRefreshing]=useState(false)

  async function load(){
    setRefreshing(true)
    try{const r=await api('get','/admin/health-check');setData(r.data)}catch{}
    setLoading(false);setRefreshing(false)
  }
  useEffect(()=>{load()},[])

  const STATUS_COLOR={ok:C.green,configured:C.green,missing:C.red,error:C.red}
  const STATUS_LABEL={ok:'OK',configured:'Configured',missing:'Missing',error:'Error'}

  if (loading) return <Loader/>
  if (!data) return <p style={{fontFamily:MONO,fontSize:11,color:C.red}}>Failed to load health data.</p>

  const checks=data.checks||{}
  return <div style={{display:'flex',flexDirection:'column',gap:28}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      <div><Sub>Last checked: {new Date(data.timestamp).toLocaleString()}</Sub></div>
      <button onClick={load} disabled={refreshing} style={btn()}>{refreshing?'Checking…':'↺ Refresh'}</button>
    </div>
    {/* Services */}
    <div>
      <SecTitle>Services & integrations</SecTitle>
      <div style={card({overflow:'hidden'})}>
        {Object.entries(checks).map(([name,info],i,arr)=>{
          const status=info.status||'unknown'
          const color=STATUS_COLOR[status]||C.muted
          const isLast=i===arr.length-1
          return <div key={name} style={{display:'flex',alignItems:'center',padding:'14px 20px',borderBottom:isLast?'none':`1px solid ${C.border}`,gap:16}}>
            <div style={{width:10,height:10,borderRadius:'50%',background:color,flexShrink:0,boxShadow:`0 0 8px ${color}60`}}/>
            <div style={{flex:1}}>
              <p style={{fontFamily:SANS,fontSize:13,fontWeight:600,color:C.text,textTransform:'capitalize'}}>{name.replace('_',' ')}</p>
              {info.prefix&&<Sub>Key: {info.prefix}</Sub>}
              {info.latency_ms!==undefined&&<Sub>Latency: {info.latency_ms}ms</Sub>}
              {info.count!==undefined&&<Sub>Count: {info.count}</Sub>}
              {info.error&&<Sub style={{color:C.red}}>{info.error}</Sub>}
            </div>
            <Tag color={color}>{STATUS_LABEL[status]||status}</Tag>
          </div>
        })}
      </div>
    </div>
    {/* Summary */}
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
      {[['Healthy',Object.values(checks).filter(c=>['ok','configured'].includes(c.status)).length,C.green],
        ['Issues',Object.values(checks).filter(c=>['missing','error'].includes(c.status)).length,C.red],
        ['Total checks',Object.values(checks).length,C.muted]
      ].map(([l,v,c])=><StatCard key={l} label={l} value={v} color={c}/>)}
    </div>
  </div>
}

// ── Audit Log ─────────────────────────────────────────────────────────────────
function AuditLog({token}) {
  const api=useApi(token)
  const [logs,setLogs]=useState([]), [page,setPage]=useState(0), [filter,setFilter]=useState(''), [loading,setLoading]=useState(true)
  const load=useCallback(async(p,f)=>{
    setLoading(true)
    try{const r=await api('get',`/admin/audit-logs?page=${p}&action=${encodeURIComponent(f||'')}`);setLogs(r.data.logs||[])}catch{}
    setLoading(false)
  },[api])
  useEffect(()=>{load(0,filter)},[filter])
  const ACTION_COLORS={update_user:C.blue,admin_user_created:C.green,admin_user_deleted:C.red,flag_toggled:C.purple,announcement_created:C.teal,email_blast:C.pink,changelog_created:C.amber}
  const uniqueActions=[...new Set(logs.map(l=>l.action))]
  return <div style={{display:'flex',flexDirection:'column',gap:20}}>
    <div style={{display:'flex',gap:10,alignItems:'center'}}>
      <select style={sel()} value={filter} onChange={e=>{setFilter(e.target.value);setPage(0)}}>
        <option value="">All actions</option>
        {uniqueActions.map(a=><option key={a} value={a}>{a}</option>)}
      </select>
      <button style={btn()} onClick={()=>load(page,filter)}>↺ Refresh</button>
      <span style={{fontFamily:MONO,fontSize:10,color:C.muted,marginLeft:'auto'}}>{logs.length} entries</span>
    </div>
    {loading?<Loader/>:logs.length===0?<div style={card({padding:'40px 24px',textAlign:'center'})}>
      <p style={{fontFamily:MONO,fontSize:11,color:C.muted}}>No audit log entries yet.</p>
      <p style={{fontFamily:MONO,fontSize:10,color:C.faint,marginTop:6}}>Admin actions appear here automatically.</p>
    </div>:<div style={card({overflow:'hidden'})}>
      <div style={{display:'grid',gridTemplateColumns:'160px 1fr 1fr 150px',padding:'8px 16px',borderBottom:`1px solid ${C.border}`}}>
        {['Action','Admin','Target / Detail','Timestamp'].map(h=><span key={h} style={{fontFamily:MONO,fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:C.faint}}>{h}</span>)}
      </div>
      {logs.map((l,i)=>{
        const color=ACTION_COLORS[l.action]||C.muted
        const ts=new Date(l.created_at); const timeStr=isNaN(ts.getTime())?l.created_at?.slice(0,16):ts.toLocaleString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})
        const detail=l.target||(l.metadata?JSON.stringify(l.metadata).slice(0,80):'—')
        return <div key={l.id} style={{display:'grid',gridTemplateColumns:'160px 1fr 1fr 150px',padding:'11px 16px',borderBottom:i<logs.length-1?`1px solid ${C.border}`:'none',alignItems:'center'}}>
          <Tag color={color}>{(l.action||'').replace(/_/g,' ')}</Tag>
          <span style={{fontFamily:MONO,fontSize:11,color:C.muted}}>{l.admin_email}</span>
          <span style={{fontFamily:MONO,fontSize:11,color:C.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{detail}</span>
          <span style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{timeStr}</span>
        </div>
      })}
    </div>}
    {logs.length>=100&&<div style={{display:'flex',gap:8,justifyContent:'center'}}>
      <button style={btn()} disabled={page===0} onClick={()=>{const p=page-1;setPage(p);load(p,filter)}}>← Prev</button>
      <span style={{fontFamily:MONO,fontSize:11,color:C.muted}}>Page {page+1}</span>
      <button style={btn()} onClick={()=>{const p=page+1;setPage(p);load(p,filter)}}>Next →</button>
    </div>}
  </div>
}

// ── Feature Flags ─────────────────────────────────────────────────────────────
const CAT_LABELS={pages:'Pages',enrichment:'Enrichment',outreach:'Outreach',ui:'UI / Views',data:'Data & Export',leads:'Leads'}

function FeatureFlags({token}) {
  const api=useApi(token)
  const [flags,setFlags]=useState([]), [loading,setLoading]=useState(true), [toggling,setToggling]=useState(null), [msg,flash]=useFlash()
  useEffect(()=>{axios.get(`${API_BASE}/feature-flags`).then(r=>setFlags(r.data?.flags||[])).catch(()=>{}).finally(()=>setLoading(false))},[])
  async function handleToggleFlag(name,current){
    setToggling(name)
    try{
      await api('patch',`/feature-flags/${name}`,{enabled:!current})
      setFlags(prev=>prev.map(f=>f.name===name?{...f,enabled:!current}:f))
      await api('post','/admin/audit-log',{action:'flag_toggled',target:name,metadata:{enabled:!current}})
      flash(`${name} → ${!current?'enabled':'disabled'}`)
    }catch{flash('Failed',false)}
    setToggling(null)
  }
  const cats=[...new Set(flags.map(f=>f.category))]
  const en=flags.filter(f=>f.enabled).length, dis=flags.filter(f=>!f.enabled).length
  if (loading) return <Loader/>
  return <div style={{display:'flex',flexDirection:'column',gap:28}}>
    <div style={{display:'flex',gap:10}}>
      <StatCard label="Enabled" value={en} color={C.green}/>
      <StatCard label="Disabled" value={dis} color={C.red}/>
      <StatCard label="Total" value={flags.length}/>
    </div>
    <Flash msg={msg}/>
    <div style={{background:'rgba(5,150,105,0.05)',border:'1px solid rgba(5,150,105,0.15)',borderRadius:8,padding:'12px 16px'}}>
      <p style={{fontFamily:MONO,fontSize:11,color:'rgba(5,150,105,0.85)',lineHeight:1.5}}>Flags gate <strong>regular users only</strong>. Admin-panel accounts always see 100% of features.</p>
    </div>
    {cats.map(cat=><div key={cat}>
      <SecTitle>{CAT_LABELS[cat]||cat}</SecTitle>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:8}}>
        {flags.filter(f=>f.category===cat).map(flag=><div key={flag.name} style={card({display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 16px',gap:12,borderColor:flag.enabled?'rgba(5,150,105,0.22)':C.border})}>
          <div style={{flex:1,minWidth:0}}>
            <Label style={{color:flag.enabled?C.text:C.muted,fontSize:12}}>{flag.label}</Label>
            {flag.description&&<Sub style={{marginTop:3}}>{flag.description}</Sub>}
          </div>
          <button onClick={()=>handleToggleFlag(flag.name,flag.enabled)} disabled={toggling===flag.name} style={toggle(flag.enabled)}>
            <span style={knob(flag.enabled)}/>
          </button>
        </div>)}
      </div>
    </div>)}
  </div>
}

// ── Team Members ──────────────────────────────────────────────────────────────
function TeamMembers({token}) {
  const api=useApi(token)
  const [members,setMembers]=useState([]), [invites,setInvites]=useState([]), [loading,setLoading]=useState(true)
  const [msg,flash]=useFlash(), [mode,setMode]=useState('create'), [sub,setSub]=useState(false), [delId,setDelId]=useState(null)
  const [cuName,setCuName]=useState(''), [cuEmail,setCuEmail]=useState(''), [cuPw,setCuPw]=useState(''), [cuRole,setCuRole]=useState('member'), [showPw,setShowPw]=useState(false)
  const [invEmail,setInvEmail]=useState(''), [invRole,setInvRole]=useState('member')
  const reload=useCallback(async()=>{try{const[m,i]=await Promise.all([api('get','/admin/members'),api('get','/admin/invites')]);setMembers(m.data||[]);setInvites(i.data||[])}catch{}},[api])
  useEffect(()=>{reload().finally(()=>setLoading(false))},[])
  async function handleCreate(e){e.preventDefault();setSub(true);try{await api('post','/admin/create-user',{name:cuName.trim(),email:cuEmail.trim(),password:cuPw,role:cuRole});flash(`Account created for ${cuEmail.trim()}`);setCuName('');setCuEmail('');setCuPw('');setCuRole('member');reload()}catch(err){flash(err?.response?.data?.detail||'Failed',false)};setSub(false)}
  async function handleInvite(e){e.preventDefault();setSub(true);try{await api('post','/admin/invite',{email:invEmail.trim(),role:invRole});flash(`Invite sent to ${invEmail.trim()}`);setInvEmail('');reload()}catch(err){flash(err?.response?.data?.detail||'Failed',false)};setSub(false)}
  async function handleDelete(id,email){if(!confirm(`Delete ${email}?`))return;setDelId(id);try{await api('delete',`/admin/users/${id}`);flash(`${email} deleted`);setMembers(prev=>prev.filter(m=>m.id!==id))}catch(err){flash(err?.response?.data?.detail||'Failed',false)};setDelId(null)}
  const tabBtns=[['create','Create account'],['invite','Send invite']]
  if (loading) return <Loader/>
  return <div style={{display:'flex',flexDirection:'column',gap:28}}>
    <div style={card({overflow:'hidden'})}>
      <div style={{padding:'18px 22px',borderBottom:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
        <div><Label style={{fontSize:15}}>Add a user</Label><Sub style={{marginTop:3}}>Create an account instantly or send an email invite.</Sub></div>
        <div style={{display:'flex',gap:6}}>{tabBtns.map(([id,label])=><button key={id} onClick={()=>setMode(id)} style={btn({color:mode===id?C.text:C.muted,borderColor:mode===id?C.strong:C.border,background:mode===id?'rgba(255,255,255,0.06)':'transparent'})}>{label}</button>)}</div>
      </div>
      <div style={{padding:22}}>
        {mode==='create'?<form onSubmit={handleCreate}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div><Sub style={{marginBottom:5}}>Full name</Sub><input style={input()} placeholder="Jane Smith" value={cuName} onChange={e=>setCuName(e.target.value)}/></div>
            <div><Sub style={{marginBottom:5}}>Email *</Sub><input style={input()} type="email" placeholder="jane@co.com" value={cuEmail} onChange={e=>setCuEmail(e.target.value)} required/></div>
            <div style={{position:'relative'}}><Sub style={{marginBottom:5}}>Password *</Sub><input style={input()} type={showPw?'text':'password'} placeholder="Min. 8 chars" value={cuPw} onChange={e=>setCuPw(e.target.value)} required minLength={8}/><button type="button" onClick={()=>setShowPw(v=>!v)} style={{position:'absolute',right:10,bottom:9,background:'none',border:'none',cursor:'pointer',fontFamily:MONO,fontSize:9,color:C.muted}}>{showPw?'hide':'show'}</button></div>
            <div><Sub style={{marginBottom:5}}>Role</Sub><select style={sel({width:'100%'})} value={cuRole} onChange={e=>setCuRole(e.target.value)}><option value="member">member</option><option value="admin">admin</option></select></div>
          </div>
          <button type="submit" disabled={sub} style={priBtn(sub)}>{sub?'Creating…':'Create account'}</button>
        </form>:<form onSubmit={handleInvite}>
          <div style={{display:'flex',gap:10,alignItems:'flex-end',marginBottom:10}}>
            <div style={{flex:1}}><Sub style={{marginBottom:5}}>Email *</Sub><input style={input()} type="email" placeholder="jane@co.com" value={invEmail} onChange={e=>setInvEmail(e.target.value)} required/></div>
            <div><Sub style={{marginBottom:5}}>Role</Sub><select style={sel()} value={invRole} onChange={e=>setInvRole(e.target.value)}><option value="member">member</option><option value="admin">admin</option></select></div>
            <button type="submit" disabled={sub} style={priBtn(sub)}>{sub?'Sending…':'Send invite'}</button>
          </div>
        </form>}
        <Flash msg={msg}/>
      </div>
    </div>
    <div>
      <SecTitle>Members ({members.length})</SecTitle>
      <div style={card({overflow:'hidden'})}>
        {members.length===0?<p style={{fontFamily:MONO,fontSize:10,color:C.muted,padding:'20px 18px'}}>No members.</p>
        :members.map((m,i)=><div key={m.id} style={{display:'flex',alignItems:'center',padding:'12px 18px',borderBottom:i<members.length-1?`1px solid ${C.border}`:'none',gap:14}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:C.raised,border:`1px solid ${C.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:MONO,fontSize:12,fontWeight:700,color:C.text,flexShrink:0}}>{(m.full_name||m.email||'?')[0].toUpperCase()}</div>
          <div style={{flex:1,minWidth:0}}><Label style={{fontSize:12}}>{m.full_name||'—'}</Label><Sub style={{marginTop:2}}>{m.email}</Sub></div>
          <select style={sel()} value={m.role} onChange={e=>api('patch',`/admin/members/${m.id}`,{role:e.target.value}).then(()=>setMembers(prev=>prev.map(x=>x.id===m.id?{...x,role:e.target.value}:x))).catch(()=>flash('Failed',false))}>
            <option value="member">member</option><option value="admin">admin</option><option value="owner">owner</option>
          </select>
          <button onClick={()=>handleDelete(m.id,m.email)} disabled={delId===m.id} style={redBtn({opacity:delId===m.id?0.5:1})}>{delId===m.id?'…':'Delete'}</button>
        </div>)}
      </div>
    </div>
    {invites.length>0&&<div>
      <SecTitle>Pending invites ({invites.length})</SecTitle>
      <div style={card({overflow:'hidden'})}>
        {invites.map((inv,i)=><div key={inv.id} style={{display:'flex',alignItems:'center',padding:'12px 18px',borderBottom:i<invites.length-1?`1px solid ${C.border}`:'none',gap:14}}>
          <div style={{flex:1}}><Label style={{fontSize:12}}>{inv.email}</Label><Sub style={{marginTop:2}}>{inv.role} · sent {(inv.created_at||'').slice(0,10)}</Sub></div>
          <button onClick={()=>api('delete',`/admin/invites/${inv.id}`).then(()=>setInvites(prev=>prev.filter(x=>x.id!==inv.id))).catch(()=>{})} style={btn()}>Revoke</button>
        </div>)}
      </div>
    </div>}
  </div>
}

// ── Access Control ────────────────────────────────────────────────────────────
function AccessControl() {
  return <div style={{display:'flex',flexDirection:'column',gap:20}}>
    <div style={card({padding:'20px 24px'})}>
      <Label style={{marginBottom:8}}>Admin allowlist</Label>
      <Sub style={{lineHeight:1.7,marginBottom:16}}>Only these addresses can sign in. Edit <code style={{background:C.raised,padding:'1px 5px',borderRadius:4}}>ALLOWED_EMAILS</code> in <code style={{background:C.raised,padding:'1px 5px',borderRadius:4}}>admin-panel/src/App.jsx</code> and redeploy to change.</Sub>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {ALLOWED_EMAILS.map(e=><div key={e} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:C.raised,borderRadius:7,border:`1px solid ${C.border}`}}>
          <span style={{width:7,height:7,background:C.green,borderRadius:'50%',flexShrink:0}}/>
          <span style={{fontFamily:MONO,fontSize:12,color:C.text}}>{e}</span>
          <Tag color={C.green}>authorised</Tag>
        </div>)}
      </div>
    </div>
    <div style={card({padding:'20px 24px'})}>
      <Label style={{marginBottom:14}}>Security posture</Label>
      <ul style={{listStyle:'none',display:'flex',flexDirection:'column',gap:12}}>
        {[[C.green,'noindex · nofollow','Search engines cannot index this panel'],[C.green,'X-Frame-Options: DENY','Iframe embedding blocked at CDN level'],[C.green,'Email + allowlist gate','Must authenticate AND be in ALLOWED_EMAILS'],[C.green,'Supabase RLS','All DB operations row-level secured'],[C.green,'Audit log','Every admin action recorded with actor email + timestamp'],[C.amber,'No TOTP yet','Consider adding authenticator-app 2FA for higher assurance']].map(([color,key,val])=><li key={key} style={{display:'flex',gap:12,alignItems:'flex-start'}}>
          <span style={{width:7,height:7,background:color,borderRadius:'50%',flexShrink:0,marginTop:4}}/>
          <div><p style={{fontFamily:MONO,fontSize:11,color:C.text}}>{key}</p><Sub style={{marginTop:2}}>{val}</Sub></div>
        </li>)}
      </ul>
    </div>
  </div>
}

// ── App shell ─────────────────────────────────────────────────────────────────
const TABS=[
  {id:'overview',  label:'Overview'},
  {id:'analytics', label:'Analytics'},
  {id:'users',     label:'Users'},
  {id:'comms',     label:'Comms'},
  {id:'changelog', label:'Changelog'},
  {id:'audit',     label:'Audit Log'},
  {id:'flags',     label:'Feature Flags'},
  {id:'health',    label:'System Health'},
  {id:'team',      label:'Team'},
  {id:'access',    label:'Access Control'},
]
const TAB_DESC={
  overview: 'Live platform metrics, 30-day growth trends, and recent user activity.',
  analytics:'DAU/WAU/MAU, feature adoption rates, retention cohorts, and top users.',
  users:    'Search, filter, suspend, change roles, or delete any user. Click any row to open user detail.',
  comms:    'Publish in-app announcement banners and send email blasts to user segments.',
  changelog:'Publish release notes visible to users inside the main app.',
  audit:    'Chronological log of every admin action with actor email and timestamp.',
  flags:    'Toggle features on/off for regular users without a code deploy.',
  health:   'Live status of all backend services, API keys, and integrations.',
  team:     'Create accounts, send invites, manage roles for your internal team.',
  access:   'Admin panel security configuration and access allowlist.',
}

export default function App() {
  const [user,setUser]=useState(null), [token,setToken]=useState(null), [checking,setChecking]=useState(true), [tab,setTab]=useState('overview')
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if (session?.user&&ALLOWED_EMAILS.includes(session.user.email)){setUser(session.user);setToken(session.access_token)}
      setChecking(false)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_e,session)=>{
      if (session?.user&&ALLOWED_EMAILS.includes(session.user.email)){setUser(session.user);setToken(session.access_token)}
      else{setUser(null);setToken(null)}
    })
    return ()=>subscription.unsubscribe()
  },[])
  if (checking) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:C.bg}}><p style={{fontFamily:MONO,fontSize:11,color:C.muted}}>Verifying session…</p></div>
  if (!user) return <Login onLogin={(u,t)=>{setUser(u);setToken(t)}}/>
  return <div style={{minHeight:'100vh',background:C.bg,color:C.text}}>
    {/* Topbar */}
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',height:54,borderBottom:`1px solid ${C.border}`,background:C.bg,position:'sticky',top:0,zIndex:100}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <SonarLogo size={26}/>
        <span style={{fontFamily:SANS,fontWeight:700,fontSize:15,letterSpacing:'-0.03em',color:C.text}}>Sonar</span>
        <Tag color={C.red}>Admin</Tag>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        {token&&<GlobalSearch token={token}/>}
        <span style={{fontFamily:MONO,fontSize:10,color:C.muted}}>{user.email}</span>
        <button onClick={()=>supabase.auth.signOut().then(()=>{setUser(null);setToken(null)})} style={btn()}>Sign out</button>
      </div>
    </div>
    {/* Tab nav */}
    <div style={{borderBottom:`1px solid ${C.border}`,background:C.bg,overflowX:'auto'}}>
      <div style={{maxWidth:1280,margin:'0 auto',padding:'0 32px',display:'flex',gap:0,minWidth:'max-content'}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} style={{fontFamily:MONO,fontSize:11,padding:'13px 16px',background:'none',border:'none',cursor:'pointer',color:tab===t.id?C.text:C.muted,borderBottom:tab===t.id?`2px solid ${C.text}`:'2px solid transparent',transition:'color 0.15s',whiteSpace:'nowrap'}}>{t.label}</button>)}
      </div>
    </div>
    {/* Content */}
    <div style={{maxWidth:1280,margin:'0 auto',padding:'36px 32px'}}>
      <div style={{marginBottom:28}}>
        <h1 style={{fontFamily:SANS,fontSize:26,fontWeight:700,letterSpacing:'-0.04em',color:C.text,marginBottom:6}}>{TABS.find(t=>t.id===tab)?.label}</h1>
        <p style={{fontFamily:MONO,fontSize:11,color:C.muted}}>{TAB_DESC[tab]}</p>
      </div>
      {tab==='overview'  &&token&&<Overview    token={token}/>}
      {tab==='analytics' &&token&&<Analytics   token={token}/>}
      {tab==='users'     &&token&&<Users        token={token}/>}
      {tab==='comms'     &&token&&<Comms        token={token}/>}
      {tab==='changelog' &&token&&<Changelog    token={token}/>}
      {tab==='audit'     &&token&&<AuditLog     token={token}/>}
      {tab==='flags'     &&token&&<FeatureFlags token={token}/>}
      {tab==='health'    &&token&&<SystemHealth token={token}/>}
      {tab==='team'      &&token&&<TeamMembers  token={token}/>}
      {tab==='access'    &&<AccessControl/>}
    </div>
  </div>
}
