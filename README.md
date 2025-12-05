<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
  <title>ChronoLog - 8BIT EDITION</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel="stylesheet">

  <script>
    window.tailwind = {
      theme: {
        extend: {
          fontFamily: {
            'pixel': ['"Press Start 2P"', 'cursive'],
            'terminal': ['"VT323"', 'monospace'],
          },
          colors: {
            arcade: {
              bg: '#202028',
              green: '#43b581',
              yellow: '#f5c542',
              red: '#f04747',
              purple: '#7289da',
              dark: '#0e0e10',
              light: '#dadada'
            }
          },
          animation: {
            'blink': 'blink 1s step-end infinite',
            'glitch': 'glitch 1s linear infinite',
            'scanline': 'scanline 8s linear infinite',
          },
          keyframes: {
            blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
            scanline: { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100%)' } }
          }
        }
      }
    };
  </script>
  <script src="https://cdn.tailwindcss.com"></script>

  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/ethers@6.8.1/dist/ethers.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@walletconnect/web3-provider@1.7.8/dist/umd/index.min.js"></script>

  <style>
    /* === 像素风核心样式 === */
    body {
      background-color: #202028;
      color: #dadada;
      font-family: "VT323", monospace;
      overflow-x: hidden;
      cursor: crosshair; /* 十字准星光标 */
    }

    /* 像素边框 (NES Style) */
    .nes-box {
      background: #0e0e10;
      border: 4px solid #dadada;
      box-shadow: 6px 6px 0px 0px rgba(0,0,0,0.5);
      position: relative;
    }
    
    .nes-btn {
      background: #dadada;
      color: #0e0e10;
      border: 4px solid #fff;
      border-right-color: #7d7d7d;
      border-bottom-color: #7d7d7d;
      box-shadow: 4px 4px 0px 0px #000;
      transition: all 0.1s;
      text-transform: uppercase;
      cursor: pointer;
    }
    .nes-btn:active:not(:disabled) {
      transform: translate(4px, 4px);
      box-shadow: 0px 0px 0px 0px #000;
    }
    .nes-btn-primary { background: #7289da; color: #fff; border-color: #99aab5; border-right-color: #4f545c; border-bottom-color: #4f545c; }
    .nes-btn-success { background: #43b581; color: #fff; border-color: #6bd6a6; border-right-color: #2a7552; border-bottom-color: #2a7552; }
    .nes-btn-warning { background: #f5c542; color: #000; border-color: #ffeba1; border-right-color: #a88420; border-bottom-color: #a88420; }

    /* CRT 扫描线特效 */
    .scanlines {
      background: linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2));
      background-size: 100% 4px;
      position: fixed; top: 0; right: 0; bottom: 0; left: 0;
      z-index: 9999; pointer-events: none;
    }
    .vignette {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: radial-gradient(circle, rgba(0,0,0,0) 60%, rgba(0,0,0,0.4) 100%);
      z-index: 9998; pointer-events: none;
    }

    /* 手机日期修复 (像素版) */
    input[type="datetime-local"] {
        appearance: none; -webkit-appearance: none; color-scheme: dark;
        background: #000; border: 2px solid #dadada; color: #43b581;
        font-family: "VT323", monospace; font-size: 1.2rem;
        padding: 10px; min-height: 50px; width: 100%; display: block;
        position: relative; z-index: 50; cursor: pointer;
        box-shadow: inset 4px 4px 0px rgba(0,0,0,0.5);
    }
    
    /* 滚动条 */
    ::-webkit-scrollbar { width: 12px; background: #0e0e10; }
    ::-webkit-scrollbar-thumb { background: #dadada; border: 2px solid #0e0e10; }
  </style>
</head>
<body>

  <div class="scanlines"></div>
  <div class="vignette"></div>

  <div id="root" class="relative z-10 p-4 pb-20 max-w-4xl mx-auto"></div>

<script type="text/babel">

// 配置
const CONTRACT_ADDRESS = "0x1A46b403A29c8cBDA564E1f4B9c6332b8873532f";
const ARBITRUM_SEPOLIA_CHAIN_ID_DEC = 421614;

const ABI = [
  {inputs:[{internalType:"string",name:"_content",type:"string"},{internalType:"uint256",name:"_unlockTime",type:"uint256"}],name:"createLog",outputs:[],stateMutability:"nonpayable",type:"function"},
  {inputs:[],name:"getAllLogs",outputs:[{components:[{internalType:"uint256",name:"id",type:"uint256"},{internalType:"address",name:"author",type:"address"},{internalType:"string",name":"content",type:"string"},{internalType:"uint256",name":"timestamp",type:"uint256"},{internalType:"uint256",name":"unlockTime",type:"uint256"}],internalType":"struct ChronoLog.Log[]",name:"",type:"tuple[]"}],stateMutability:"view",type:"function"}
];

const { useState, useEffect } = React;
const ethers = window.ethers;

// 工具
function shortAddr(a) { if(!a) return "Player 1"; return a.slice(0,6)+".."+a.slice(-4); }
function fmtTs(s) { try{const n=Number(s); return n?new Date(n*1000).toLocaleString():"??-??-??";}catch{return "ERR";} }
function getLevel(count) { return Math.floor(Math.sqrt(count)) + 1; } // 简单的等级公式

// 缓存
const CACHE_KEY = "chrono_arcade_v1";
function readCache(){try{const r=localStorage.getItem(CACHE_KEY);if(!r)return null;const o=JSON.parse(r);return(Date.now()-o.ts)>60000?null:o.data}catch{return null}}
function writeCache(d){try{localStorage.setItem(CACHE_KEY,JSON.stringify({ts:Date.now(),data:d}))}catch{}}

// WalletConnect
async function createWC() {
  const r={};r[ARBITRUM_SEPOLIA_CHAIN_ID_DEC]="https://sepolia-rollup.arbitrum.io/rpc";
  if(!window.WalletConnectProvider) throw new Error("Missing Lib");
  const WCP=window.WalletConnectProvider.default||window.WalletConnectProvider;
  return new WCP({rpc:r, chainId:ARBITRUM_SEPOLIA_CHAIN_ID_DEC, qrcode:true});
}

function PixelNotice({type, msg, onClose}) {
  const colors = { error: "bg-arcade-red text-white", success: "bg-arcade-green text-black", info: "bg-arcade-yellow text-black" };
  return (
    <div className={`nes-box mb-6 p-4 ${colors[type] || colors.info} animate-bounce`}>
      <div className="flex justify-between items-center">
        <span className="font-pixel text-xs uppercase flex items-center gap-2">
          {type==='error'?'👾 ERROR':'🏆 SUCCESS'} : {msg}
        </span>
        <button onClick={onClose} className="font-bold border-2 border-black px-2 hover:bg-white/50">X</button>
      </div>
    </div>
  );
}

function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [account, setAccount] = useState(null);
  const [network, setNetwork] = useState(null);
  const [contract, setContract] = useState(null);
  
  const [tab, setTab] = useState("moment");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  
  const [txt, setTxt] = useState("");
  const [date, setDate] = useState("");
  const [logs, setLogs] = useState([]);
  const [filterMine, setFilterMine] = useState(false); // 新功能：筛选
  
  // 玩家数据
  const myLogCount = logs.filter(l => l.author.toLowerCase() === account?.toLowerCase()).length;
  const level = getLevel(myLogCount);

  // 初始化
  useEffect(() => { const c=readCache(); if(c) setLogs(c); }, []);
  useEffect(() => { if(notice) { const t=setTimeout(()=>setNotice(null),5000); return ()=>clearTimeout(t); } }, [notice]);

  // Read-only
  useEffect(() => {
    if(!provider) {
      const rpc = new ethers.JsonRpcProvider("https://sepolia-rollup.arbitrum.io/rpc", {name:"Arb Sepolia", chainId:ARBITRUM_SEPOLIA_CHAIN_ID_DEC});
      setContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, rpc));
      setNetwork({chainId: BigInt(ARBITRUM_SEPOLIA_CHAIN_ID_DEC)});
      if(logs.length===0) fetchLogs(new ethers.Contract(CONTRACT_ADDRESS, ABI, rpc));
    }
  }, [provider]);

  async function connect(mode) {
    setNotice(null);
    try {
      setLoading(true);
      let p_temp, t;
      if(mode === 'injected') {
        t = window.okxwallet || window.ethereum;
        if(!t) throw new Error("No Wallet Found");
        await t.request({method:"eth_requestAccounts"});
        p_temp = new ethers.BrowserProvider(t, "any");
      } else {
        const wc = await createWC(); await wc.enable();
        p_temp = new ethers.BrowserProvider(wc, "any");
        wc.on("disconnect", ()=>window.location.reload());
      }
      
      const s = await p_temp.getSigner();
      const a = await s.getAddress();
      const n = await p_temp.getNetwork();
      
      setProvider(p_temp); setSigner(s); setAccount(a); setNetwork(n);
      setContract(new ethers.Contract(CONTRACT_ADDRESS, ABI, s));
      setNotice({type:'success', msg: "PLAYER 1 READY"});
    } catch(e) { setNotice({type:'error', msg: e.message}); } 
    finally { setLoading(false); }
  }

  async function handleTx() {
    if(!signer) return setNotice({type:'error', msg: "INSERT COIN (Connect Wallet)"});
    if(!txt.trim()) return setNotice({type:'error', msg: "EMPTY INPUT"});
    if(network.chainId !== BigInt(ARBITRUM_SEPOLIA_CHAIN_ID_DEC)) return setNotice({type:'error', msg: "WRONG STAGE (Switch Network)"});

    let ts = 0;
    if(tab === 'capsule') {
      if(!date) return setNotice({type:'error', msg: "SET TIMER"});
      ts = Math.floor(new Date(date).getTime()/1000);
      if(ts <= Date.now()/1000) return setNotice({type:'error', msg: "FUTURE ONLY"});
    }

    try {
      setLoading(true);
      const tx = await contract.createLog(txt, BigInt(ts));
      setNotice({type:'info', msg: "SAVING GAME..."});
      await tx.wait();
      setNotice({type:'success', msg: "GAME SAVED! +10 EXP"});
      setTxt(""); setDate("");
      fetchLogs(contract, true);
    } catch(e) { 
      console.error(e); 
      setNotice({type:'error', msg: "GAME OVER: " + (e.reason||"Tx Failed")}); 
    } finally { setLoading(false); }
  }

  async function fetchLogs(c, bypass) {
    if(!c) return;
    try {
      if(!bypass) { const cached=readCache(); if(cached){setLogs(cached);return;} }
      const raw = await c.getAllLogs();
      const fmt = raw.map(r=>({
        id:Number(r.id), author:r.author, content:r.content, timestamp:Number(r.timestamp), unlockTime:Number(r.unlockTime)
      })).sort((a,b)=>b.id-a.id);
      setLogs(fmt); writeCache(fmt);
    } catch(e){ console.error(e); }
  }

  const isWrongNet = network?.chainId && network.chainId !== BigInt(ARBITRUM_SEPOLIA_CHAIN_ID_DEC);
  const displayLogs = filterMine ? logs.filter(l => l.author.toLowerCase() === account?.toLowerCase()) : logs;

  return (
    <div className="min-h-screen font-terminal text-lg selection:bg-arcade-green selection:text-black">
      
      {/* 顶部 HUD */}
      <header className="flex flex-col md:flex-row justify-between items-end mb-8 border-b-4 border-arcade-light pb-4">
        <div>
          <h1 className="text-4xl md:text-6xl font-pixel text-arcade-yellow drop-shadow-[4px_4px_0_#b91c1c] animate-pulse">
            ChronoLog
          </h1>
          <p className="mt-2 text-arcade-green uppercase text-xl">> PRESS START TO RECORD MEMORY_</p>
        </div>
        
        <div className="mt-4 md:mt-0 text-right">
           {account ? (
             <div className="nes-box p-2 bg-arcade-dark flex flex-col items-end">
               <div className="font-pixel text-xs text-arcade-purple mb-1">PLAYER 1</div>
               <div className="text-2xl text-white">{shortAddr(account)}</div>
               <div className="flex gap-4 mt-1 text-sm text-arcade-light">
                 <span>LVL <span className="text-arcade-yellow">{level}</span></span>
                 <span>EXP <span className="text-arcade-green">{myLogCount * 10}</span></span>
               </div>
             </div>
           ) : (
             <div className="animate-blink font-pixel text-arcade-red">INSERT COIN</div>
           )}
        </div>
      </header>

      {/* 提示框 */}
      {notice && <PixelNotice type={notice.type} msg={notice.msg} onClose={()=>setNotice(null)} />}

      {/* 登录界面 */}
      {!account && (
        <div className="nes-box p-8 text-center max-w-lg mx-auto mt-12 bg-arcade-dark">
          <h2 className="font-pixel text-xl mb-8 text-white">SELECT CONTROLLER</h2>
          <div className="flex flex-col gap-6">
            <button onClick={()=>connect('injected')} className="nes-btn nes-btn-primary py-4 font-bold text-xl hover:scale-105">
              JOYSTICK A (PC/OKX)
            </button>
            <button onClick={()=>connect('wc')} className="nes-btn py-4 font-bold text-xl hover:scale-105">
              JOYSTICK B (QR CODE)
            </button>
          </div>
        </div>
      )}

      {/* 主游戏界面 */}
      {account && (
        <main>
          
          {/* 错误网络警告 */}
          {isWrongNet && (
            <div className="bg-arcade-red text-white p-4 font-bold text-center border-4 border-white mb-6 font-pixel text-xs">
              !!! WRONG STAGE !!!<br/>SWITCH TO ARBITRUM SEPOLIA
            </div>
          )}

          {/* 控制台 (Input) */}
          <div className="nes-box p-1 mb-12 bg-arcade-dark">
            <div className="bg-[#000] border-2 border-dashed border-[#333] p-4">
              
              {/* 模式切换 */}
              <div className="flex gap-4 mb-4 border-b-2 border-[#333] pb-2">
                <button onClick={()=>setTab('moment')} className={`flex-1 font-pixel text-xs py-2 ${tab==='moment'?'text-arcade-yellow bg-[#222] border-2 border-arcade-yellow':'text-[#555]'}`}>
                  MODE A: INSTANT
                </button>
                <button onClick={()=>setTab('capsule')} className={`flex-1 font-pixel text-xs py-2 ${tab==='capsule'?'text-arcade-purple bg-[#222] border-2 border-arcade-purple':'text-[#555]'}`}>
                  MODE B: TIME CAP
                </button>
              </div>

              {/* 输入区域 */}
              <div className="relative">
                <span className="absolute top-2 left-2 text-arcade-green animate-blink">></span>
                <textarea 
                  value={tab==='moment'?txt:tab==='capsule'?capsuleContent:txt}
                  onChange={(e)=>{if(tab==='moment')setTxt(e.target.value);else setCapsuleContent(e.target.value)}} // 修复变量绑定
                  value={tab==='moment'?txt:capsuleContent} // 修复显示
                  onChange={(e)=>{tab==='moment'?setTxt(e.target.value):setCapsuleContent(e.target.value)}}
                  placeholder={tab==='moment'?"ENTER LOG DATA...":"ENTER SECRET MESSAGE..."}
                  className="w-full bg-transparent text-white pl-6 pt-2 h-32 outline-none font-terminal text-xl resize-none placeholder-[#444]"
                ></textarea>
              </div>

              {/* 胶囊时间选择 */}
              {tab === 'capsule' && (
                <div className="mt-4 border-t-2 border-[#333] pt-4">
                   <label className="block text-arcade-purple font-pixel text-[10px] mb-2">UNLOCK DATE:</label>
                   <input 
                     type="datetime-local" 
                     value={date} 
                     onChange={(e)=>setDate(e.target.value)}
                   />
                </div>
              )}

              {/* 发送按钮 */}
              <div className="mt-6 text-right">
                <button 
                  disabled={loading}
                  onClick={handleTx}
                  className={`nes-btn ${tab==='moment'?'nes-btn-success':'nes-btn-primary'} px-8 py-2 font-pixel text-xs disabled:opacity-50`}
                >
                  {loading ? "LOADING..." : "SAVE GAME"}
                </button>
              </div>
            </div>
          </div>

          {/* 排行榜 / 日志列表 */}
          <div className="flex justify-between items-end mb-4 border-b-4 border-arcade-light pb-2">
            <h2 className="font-pixel text-arcade-light text-sm md:text-lg">MEMORY CARD</h2>
            <div className="flex gap-2">
               <button onClick={()=>setFilterMine(!filterMine)} className={`border-2 border-white px-2 py-1 text-xs font-bold ${filterMine?'bg-arcade-yellow text-black':'bg-black text-white'}`}>
                 {filterMine ? '[X] MY LOGS' : '[ ] MY LOGS'}
               </button>
               <button onClick={()=>fetchLogs(contract, true)} className="border-2 border-white px-2 py-1 text-xs font-bold bg-black text-white hover:bg-white hover:text-black">
                 REFRESH
               </button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {displayLogs.length === 0 && (
              <div className="col-span-2 text-center py-20 border-2 border-dashed border-[#444] text-[#666]">
                NO DATA FOUND ON TAPE
              </div>
            )}

            {displayLogs.map((log) => {
              const isLocked = log.unlockTime > Date.now() / 1000;
              const isMine = log.author.toLowerCase() === account.toLowerCase();
              return (
                <article key={log.id} className={`nes-box p-4 bg-[#1a1a20] hover:bg-[#252530] transition ${isMine ? 'border-arcade-green' : 'border-arcade-light'}`}>
                  {/* 头部信息 */}
                  <div className="flex justify-between items-start mb-2 border-b-2 border-[#333] pb-2">
                    <div className="flex flex-col">
                      <span className={`font-pixel text-[10px] ${isMine?'text-arcade-green':'text-arcade-purple'}`}>
                        {isMine ? '★ P1 (YOU)' : 'NPC'}
                      </span>
                      <span className="text-xs text-[#888]">{shortAddr(log.author)}</span>
                    </div>
                    <div className={`px-2 py-1 font-pixel text-[10px] ${isLocked?'bg-arcade-red text-white':'bg-arcade-yellow text-black'}`}>
                      {isLocked ? 'LOCKED' : 'OPEN'}
                    </div>
                  </div>

                  {/* 内容区域 */}
                  <div className="py-4 min-h-[80px]">
                    {isLocked ? (
                      <div className="text-center text-arcade-red">
                        <div className="text-4xl mb-2">🔒</div>
                        <div className="font-pixel text-[10px] animate-pulse">ACCESS DENIED</div>
                        <div className="text-xs mt-1 text-[#666]">UNLOCKS: {fmtTs(log.unlockTime)}</div>
                      </div>
                    ) : (
                      <p className="text-xl leading-snug whitespace-pre-wrap">{log.content}</p>
                    )}
                  </div>

                  {/* 底部信息 */}
                  <div className="flex justify-between items-center text-xs text-[#555] mt-2 pt-2 border-t-2 border-[#333]">
                    <span>ID: #{log.id}</span>
                    <span>{fmtTs(log.timestamp)}</span>
                  </div>
                </article>
              );
            })}
          </div>

        </main>
      )}

      <footer className="mt-20 py-8 text-center border-t-4 border-[#333]">
        <p className="text-[#666] text-sm">INSERT COIN TO CONTINUE...</p>
        <p className="text-[#444] text-xs mt-2">POWERED BY ARBITRUM SEPOLIA ENGINE</p>
      </footer>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
</script>
</body>
</html>
