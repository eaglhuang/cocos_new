/* 3KLife Character Detail — Tab Content Panels v2 (bigger text, no dead space) */

// ===== GENE COLOR DOTS =====
function GeneDots({ genes }) {
  const GENE_COLORS = { blue:"#6fa8ff", pink:"#ff9bba", green:"#86E1A5", purple:"#c494ff", white:"#E0E0E0", red:"#ff8d6e" };
  return React.createElement("div", { style: { display:"flex", gap:4, flexWrap:"wrap" } },
    genes.map((g, i) => React.createElement("div", { key: i, style: { display:"flex", alignItems:"center", gap:3 } },
      React.createElement("span", { style: { width:10, height:10, borderRadius:"50%", background: GENE_COLORS[g.color] || "#888", display:"inline-block", flexShrink:0 } }),
      React.createElement("span", { style: { fontFamily:"var(--font-num)", fontSize:13, color:"#D0C5AF" } }, g.label),
    ))
  );
}

// ===== SECTION HEADER =====
function Sec({ children, en }) {
  return React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:8, marginBottom:10 } },
    React.createElement("div", { style:{ width:4, height:16, background:"linear-gradient(180deg,#8CCFC4,#3F6A62)", borderRadius:2 } }),
    React.createElement("span", { style:{ fontFamily:"var(--font-headline)", fontSize:18, fontWeight:700, color:"#8CCFC4", letterSpacing:".2em" } }, children),
    en && React.createElement("span", { style:{ fontFamily:"var(--font-label)", fontSize:10, color:"#6b6456", letterSpacing:".2em", textTransform:"uppercase" } }, en),
  );
}

// ===== MINI INFO ROW =====
function InfoRow({ label, value, valueStyle }) {
  return React.createElement("div", { style:{ display:"flex", alignItems:"baseline", gap:10, marginBottom:6 } },
    React.createElement("span", { style:{ fontFamily:"var(--font-headline)", fontSize:15, fontWeight:600, color:"#3F6A62", letterSpacing:".15em", minWidth:60 } }, label),
    React.createElement("span", { style:{ fontFamily:"var(--font-body)", fontSize:16, color:"#D0C5AF", ...valueStyle } }, value),
  );
}

// ===================================================================
// TAB: OVERVIEW (將)
// ===================================================================
function TabOverview({ data }) {
  const d = data;
  const rarityColor = cStyles.rarityColors[d.rarity] || "#FFC107";
  return React.createElement("div", { style:{ display:"flex", flexDirection:"column", gap:12 } },

    // HEADER ROW: name + rarity + stars
    React.createElement("div", { style:{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", borderBottom:"1px solid #4D4635", paddingBottom:10 } },
      React.createElement("div", null,
        React.createElement("div", { style:{ display:"flex", alignItems:"baseline", gap:12 } },
          React.createElement("span", { style:{ fontFamily:"var(--font-headline)", fontSize:54, fontWeight:700, color:"#F5F1E8", letterSpacing:".1em", lineHeight:1, textShadow:"0 2px 6px rgba(0,0,0,.6)" } }, d.name),
          React.createElement("span", { style:{ fontFamily:"var(--font-headline)", fontSize:20, color:"#9a8f74", letterSpacing:".15em" } }, `【${d.factionTag}】`),
        ),
        React.createElement("div", { style:{ fontFamily:"var(--font-headline)", fontStyle:"italic", fontSize:16, color:"#6b6456", letterSpacing:".08em", marginTop:2 } }, `${d.courtesy}  ·  ${d.faction} · ${d.role}`),
      ),
      React.createElement("div", { style:{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 } },
        React.createElement("span", { style:{ padding:"4px 18px", borderRadius:5, background:rarityColor, fontFamily:"var(--font-label)", fontSize:15, fontWeight:800, letterSpacing:".2em", color: d.rarity==="UR"?"#2D1E00":"#fff" } }, d.rarity),
        React.createElement("div", { style:{ display:"flex", gap:3 } },
          Array.from({ length: d.maxStars }, (_, i) => React.createElement("span", { key:i, style:{ fontSize:22, color: i < d.stars ? "#D4AF37":"#4D4635" } }, "★"))
        ),
      ),
    ),

    // THREE MINI CARDS
    React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1.1fr 0.9fr 1fr", gap:10 } },
      // Core stats
      React.createElement("div", { style: miniCard },
        React.createElement(Sec, { en:"CORE" }, "核心屬性"),
        React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 12px" } },
          [["武",d.talent.str,"#6fa8ff"],["統",d.talent.lea,"#86E1A5"],["魅",d.talent.cha,"#ff9bba"],["智",d.talent.int,"#c494ff"],["政",d.talent.pol,"#E0E0E0"],["運",d.talent.luk,"#ff8d6e"]].map(([lbl,val,col]) =>
            React.createElement("div", { key:lbl, style:{ display:"flex", alignItems:"center", gap:6 } },
              React.createElement("span", { style:{ fontFamily:"var(--font-headline)", fontSize:17, fontWeight:700, color:col, letterSpacing:".1em" } }, lbl),
              React.createElement("span", { style:{ fontFamily:"var(--font-num)", fontSize:20, fontWeight:800, color:"#FFE088" } }, val),
            )
          ),
        ),
      ),
      // Battle position
      React.createElement("div", { style: miniCard },
        React.createElement(Sec, { en:"ROLE" }, "戰場定位"),
        d.battlePos.map((p, i) => React.createElement("div", { key:i, style:{ display:"flex", alignItems:"center", gap:8, marginBottom:8 } },
          React.createElement("span", { style:{ width:8, height:8, borderRadius:4, background:"#3F6A62", display:"inline-block" } }),
          React.createElement("span", { style:{ fontFamily:"var(--font-headline)", fontSize:17, fontWeight:600, color:"#E8E4DC", letterSpacing:".1em" } }, p),
        )),
      ),
      // Personality
      React.createElement("div", { style: miniCard },
        React.createElement(Sec, { en:"TRAITS" }, "性格氣質"),
        d.personality.map((p, i) => React.createElement("div", { key:i, style:{ display:"flex", alignItems:"center", gap:8, marginBottom:8 } },
          React.createElement("span", { style:{ width:8, height:8, borderRadius:4, background:"#D4AF37", display:"inline-block" } }),
          React.createElement("span", { style:{ fontFamily:"var(--font-headline)", fontSize:17, fontWeight:600, color:"#E8E4DC", letterSpacing:".1em" } }, p),
        )),
      ),
    ),

    // BLOODLINE PANEL
    React.createElement("div", { style:{ background:"rgba(63,106,98,.08)", border:"1.5px solid rgba(63,106,98,.35)", borderRadius:10, padding:"14px 16px" } },
      React.createElement(Sec, { en:"BLOODLINE" }, "血脈"),
      React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"100px 1fr", gap:16, alignItems:"center" } },
        // Crest
        React.createElement("div", { style:{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 } },
          React.createElement("div", { style:{ width:84, height:84, borderRadius:"50%", border:"2px solid #3F6A62", background:"radial-gradient(circle, rgba(140,207,196,.12), rgba(63,106,98,.06))", display:"grid", placeItems:"center" } },
            React.createElement("svg", { viewBox:"0 0 80 80", width:72, height:72 },
              React.createElement("circle", { cx:40, cy:40, r:35, fill:"none", stroke:"#8CCFC4", strokeWidth:1, strokeDasharray:"3 3" }),
              React.createElement("g", { fill:"none", stroke:"#8CCFC4", strokeWidth:2, strokeLinecap:"round" },
                React.createElement("path", { d:"M 22 48 Q 30 28, 42 26 Q 56 26, 58 42 Q 56 54, 44 56 Q 32 54, 34 44 Q 36 36, 46 38" }),
                React.createElement("circle", { cx:24, cy:44, r:2.5, fill:"#8CCFC4", stroke:"none" }),
              ),
            ),
          ),
          React.createElement("span", { style:{ fontFamily:"var(--font-headline)", fontSize:13, color:"#3F6A62", letterSpacing:".2em" } }, "命紋顯現"),
        ),
        // Info
        React.createElement("div", { style:{ display:"flex", flexDirection:"column", gap:8 } },
          React.createElement("div", { style:{ fontFamily:"var(--font-headline)", fontSize:22, fontWeight:700, color:"#8CCFC4", letterSpacing:".3em" } }, d.bloodline.name),
          React.createElement("div", { style:{ display:"flex", alignItems:"center", gap:10 } },
            React.createElement("span", { style:{ fontFamily:"var(--font-headline)", fontSize:15, color:"#3F6A62", letterSpacing:".1em", minWidth:68 } }, "覺醒傾向"),
            React.createElement("div", { style:{ flex:1, height:10, borderRadius:5, background:"rgba(0,0,0,.2)", border:"1px solid rgba(63,106,98,.3)", overflow:"hidden" } },
              React.createElement("div", { style:{ height:"100%", width:(d.bloodline.awakening*100)+"%", borderRadius:5, background:"linear-gradient(90deg,#3F6A62,#8CCFC4)" } }),
            ),
            React.createElement("span", { style:{ fontFamily:"var(--font-num)", fontSize:16, color:"#8CCFC4", fontWeight:700 } }, Math.round(d.bloodline.awakening*100)+"%"),
          ),
          React.createElement(InfoRow, { label:"祖紋", value:d.bloodline.crestDetail }),
          React.createElement(InfoRow, { label:"印象", value:d.bloodline.impression }),
        ),
      ),
    ),

    // BIOGRAPHY
    React.createElement("div", { style:{ background:"rgba(212,175,55,.04)", border:"1.5px solid rgba(212,175,55,.2)", borderRadius:10, padding:"14px 18px" } },
      React.createElement(Sec, { en:"BIOGRAPHY" }, "人物傳記"),
      React.createElement("div", { style:{ fontFamily:"var(--font-body)", fontSize:15, color:"#D0C5AF", lineHeight:2, letterSpacing:".06em", textAlign:"justify", textIndent:"2em" } }, d.bio),
    ),

    // TITLE FOOTER
    React.createElement("div", { style:{ fontFamily:"var(--font-headline)", fontSize:18, fontWeight:600, color:"#6b6456", letterSpacing:".5em", textAlign:"center", padding:"4px 0", borderTop:"1px solid #4D4635" } }, d.title),
  );
}
const miniCard = { padding:"12px 14px", background:"rgba(255,255,255,.03)", border:"1px solid #4D4635", borderRadius:8 };

// ===================================================================
// TAB: STATS (屬性)
// ===================================================================
function TabStats({ data }) {
  const d = data;
  const STATS = [
    { key:"str", label:"武力", en:"STR", color:"#6fa8ff" },
    { key:"int", label:"智力", en:"INT", color:"#c494ff" },
    { key:"lea", label:"統率", en:"LEA", color:"#86E1A5" },
    { key:"pol", label:"政治", en:"POL", color:"#E0E0E0" },
    { key:"cha", label:"魅力", en:"CHA", color:"#ff9bba" },
    { key:"luk", label:"運氣", en:"LUK", color:"#ff8d6e" },
  ];
  // Radar
  const R=90, cx=110, cy=110, N=6;
  const angs = STATS.map((_,i)=>(Math.PI*2*i/N)-Math.PI/2);
  const dataPoints = STATS.map((s,i)=>{const v=d.talent[s.key]/100; return `${cx+R*v*Math.cos(angs[i])},${cy+R*v*Math.sin(angs[i])}`}).join(" ");
  const labelR = R+22;

  return React.createElement("div", { style:{ display:"flex", flexDirection:"column", gap:14 } },
    React.createElement(Sec, { en:"DUAL-LAYER ATTRIBUTES" }, "資質 · 實力"),
    React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"220px 1fr", gap:20, alignItems:"start" } },
      // Radar
      React.createElement("svg", { viewBox:"0 0 220 220", width:220, height:220 },
        [.25,.5,.75,1].map(s=>React.createElement("polygon",{key:s,points:angs.map(a=>`${cx+R*s*Math.cos(a)},${cy+R*s*Math.sin(a)}`).join(" "),fill:"none",stroke:"#4D4635",strokeWidth:.7})),
        angs.map((a,i)=>React.createElement("line",{key:i,x1:cx,y1:cy,x2:cx+R*Math.cos(a),y2:cy+R*Math.sin(a),stroke:"#4D4635",strokeWidth:.7})),
        React.createElement("polygon",{points:dataPoints,fill:"rgba(140,207,196,.18)",stroke:"#8CCFC4",strokeWidth:2}),
        STATS.map((s,i)=>{
          const v=d.talent[s.key]/100, px=cx+R*v*Math.cos(angs[i]), py=cy+R*v*Math.sin(angs[i]);
          const lx=cx+labelR*Math.cos(angs[i]), ly=cy+labelR*Math.sin(angs[i]);
          return React.createElement("g",{key:s.key},
            React.createElement("circle",{cx:px,cy:py,r:4,fill:s.color}),
            React.createElement("text",{x:lx,y:ly+5,textAnchor:"middle",fontSize:13,fill:s.color,fontWeight:700,fontFamily:"var(--font-headline)"},s.label),
          );
        }),
      ),
      // Stat list
      React.createElement("div", { style:{ display:"flex", flexDirection:"column", gap:10 } },
        STATS.map(s=>React.createElement("div",{key:s.key, style:{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", background:"rgba(255,255,255,.02)", border:"1px solid #4D4635", borderRadius:8 }},
          React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:18,fontWeight:700,color:s.color,letterSpacing:".1em",width:48}},s.label),
          React.createElement("span",{style:{fontFamily:"var(--font-label)",fontSize:10,color:"#6b6456",letterSpacing:".15em",width:32}},s.en),
          // Talent badge
          React.createElement("div",{style:{width:38,height:26,borderRadius:5,background:"rgba(255,224,136,.08)",border:"1px solid #8A6E1F",display:"grid",placeItems:"center",fontFamily:"var(--font-num)",fontSize:16,fontWeight:800,color:"#FFE088"}},d.talent[s.key]),
          React.createElement("span",{style:{color:"#4D4635",fontSize:14}},"→"),
          // Prowess
          React.createElement("span",{style:{fontFamily:"var(--font-num)",fontSize:22,fontWeight:800,color:"#F5F1E8",width:56,textAlign:"right"}},d.prowess[s.key].toLocaleString()),
          // Bar
          React.createElement("div",{style:{flex:1,height:8,borderRadius:4,background:"rgba(255,255,255,.04)",overflow:"hidden"}},
            React.createElement("div",{style:{height:"100%",borderRadius:4,width:Math.min(100,d.prowess[s.key]/20)+"%",background:`linear-gradient(90deg,${s.color}55,${s.color})`}}),
          ),
        )),
        // Total rank
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:14,padding:"10px 14px",background:"rgba(212,175,55,.06)",border:"1px solid rgba(212,175,55,.3)",borderRadius:8}},
          React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:16,color:"#B0A880",letterSpacing:".2em"}},"總評等級"),
          React.createElement(GradeBadge,{grade:d.prowessRank,size:42}),
          React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:18,color:"#FFE088",letterSpacing:".2em"}},"良才美質"),
        ),
      ),
    ),
    // Vitals
    React.createElement(Sec, { en:"VITALS" }, "生命狀態"),
    React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 } },
      [["HP 生命",d.hp,d.maxHp,"linear-gradient(90deg,#86E1A5,#2E8B57)"],
       ["SP 戰氣",d.sp,d.maxSp,"linear-gradient(90deg,#6fa8ff,#2b5ea8)"],
       ["精力值",d.vitality,d.vitalityMax,"linear-gradient(90deg,#FFE088,#D4AF37)"]].map(([label,val,max,col])=>
        React.createElement("div",{key:label,style:{padding:"10px 12px",background:"rgba(255,255,255,.02)",border:"1px solid #4D4635",borderRadius:8}},
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between",marginBottom:6}},
            React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:16,color:"#B0A880",letterSpacing:".1em"}},label),
            React.createElement("span",{style:{fontFamily:"var(--font-num)",fontSize:18,fontWeight:800,color:"#FFE088"}},val.toLocaleString()),
          ),
          React.createElement("div",{style:{height:10,borderRadius:5,background:"rgba(0,0,0,.2)",border:"1px solid #4D4635",overflow:"hidden"}},
            React.createElement("div",{style:{height:"100%",width:Math.round(val/max*100)+"%",borderRadius:5,background:col}}),
          ),
          React.createElement("div",{style:{fontFamily:"var(--font-label)",fontSize:11,color:"#6b6456",marginTop:4,letterSpacing:".1em"}},`/ ${max.toLocaleString()}`),
        )
      ),
    ),
    // Basic info
    React.createElement(Sec, { en:"PROFILE" }, "基本資料"),
    React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 } },
      [["年齡", `${data.age} 歲`],["精力", `${data.vitality} / ${data.vitalityMax}`],["狀態", data.status],["等級", `${data.level} / ${data.maxLevel}`]].map(([k,v])=>
        React.createElement("div",{key:k,style:{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"rgba(255,255,255,.02)",border:"1px solid #4D4635",borderRadius:8}},
          React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:16,color:"#3F6A62",letterSpacing:".15em",minWidth:44}},k),
          React.createElement("span",{style:{fontFamily:"var(--font-num)",fontSize:18,fontWeight:700,color:"#E8E4DC"}},v),
        )
      ),
    ),
  );
}

// ===================================================================
// TAB: TACTICS (技)
// ===================================================================
function TabTactics({ data }) {
  const d = data;
  return React.createElement("div", { style:{ display:"flex", flexDirection:"column", gap:12 } },
    React.createElement(Sec, { en:"LEARNED TACTICS" }, "已習得戰法"),
    d.skills.map(sk=>React.createElement("div",{key:sk.id, style:{ display:"flex", alignItems:"flex-start", gap:14, padding:"14px", background:"rgba(255,255,255,.02)", border:"1px solid #4D4635", borderRadius:10 }},
      // Icon
      React.createElement("div",{style:{ width:58, height:58, borderRadius:13, background: sk.isUlt?"radial-gradient(circle at 35% 30%,#FFBFB8,#B22222 60%,#5a0f0f)":"radial-gradient(circle at 35% 30%,#FFE088,#D4AF37 60%,#8A6E1F)", border:`2px solid ${sk.isUlt?"#5a0f0f":"#8A6E1F"}`, display:"grid", placeItems:"center", fontFamily:"var(--font-headline)", fontSize:26, fontWeight:800, color:sk.isUlt?"#FFE088":"#2D1E00", boxShadow:"inset 0 2px 4px rgba(255,255,255,.3),0 2px 8px rgba(0,0,0,.4)", flexShrink:0 }},sk.icon),
      // Info
      React.createElement("div",{style:{flex:1,minWidth:0}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8,marginBottom:5}},
          React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:20,fontWeight:700,color:"#FFE088",letterSpacing:".08em"}},sk.name),
          React.createElement("span",{style:{padding:"2px 8px",borderRadius:4,background:sk.isUlt?"#B22222":"#4D4635",color:"#FFE088",fontFamily:"var(--font-label)",fontSize:11,letterSpacing:".1em"}},sk.isUlt?"奧義":sk.type),
          sk.target && React.createElement("span",{style:{padding:"2px 8px",borderRadius:4,background:"#4D4635",color:"#FFE088",fontFamily:"var(--font-label)",fontSize:11}},sk.target),
          sk.tp>0 && React.createElement("span",{style:{padding:"2px 8px",borderRadius:4,background:"#2b5ea8",color:"#fff",fontFamily:"var(--font-label)",fontSize:11}},`TP ${sk.tp}`),
        ),
        React.createElement("div",{style:{fontFamily:"var(--font-body)",fontSize:15,color:"#D0C5AF",lineHeight:1.55}},sk.desc),
      ),
      // Level
      React.createElement("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flexShrink:0}},
        React.createElement("span",{style:{fontFamily:"var(--font-num)",fontWeight:800,fontSize:20,color:"#E8E4DC"}},`LV.${sk.level}`),
        React.createElement("span",{style:{fontFamily:"var(--font-label)",fontSize:10,color:"#6b6456",letterSpacing:".1em"}},"MAX "+sk.maxLevel),
      ),
    )),
    React.createElement(Sec, { en:"LOCKED" }, "未啟發戰法"),
    d.unlearned.map((u,i)=>React.createElement("div",{key:i, style:{ display:"flex", alignItems:"center", gap:14, padding:"12px 14px", background:"rgba(255,255,255,.01)", border:"1px dashed #4D4635", borderRadius:10, opacity:0.5 }},
      React.createElement("div",{style:{width:52,height:52,borderRadius:12,background:"linear-gradient(180deg,#353535,#1a1a1a)",border:"2px solid #353535",display:"grid",placeItems:"center",fontFamily:"var(--font-headline)",fontSize:22,color:"#4D4635"}},u.icon),
      React.createElement("div",null,
        React.createElement("div",{style:{fontFamily:"var(--font-headline)",fontSize:18,color:"#6b6456",letterSpacing:".1em"}},u.name),
        React.createElement("div",{style:{fontFamily:"var(--font-label)",fontSize:12,color:"#4D4635",marginTop:3,letterSpacing:".1em"}},`🔒 ${u.requirement}`),
      ),
    )),
  );
}

// ===================================================================
// TAB: BLOODLINE (命) — 14-person tree
// ===================================================================
function TabBloodline({ data }) {
  React.useEffect(() => {
    const wrap = document.getElementById('strip-wrap');
    const tog  = document.getElementById('strip-toggle');
    if (wrap) wrap.classList.add('open');
    if (tog)  { tog.classList.add('open'); tog.textContent = '▼ 收 起 ▼'; }
    window._stripOpen = true;
    return () => {
      if (wrap) wrap.classList.remove('open');
      if (tog)  { tog.classList.remove('open'); tog.textContent = '▲ 逸 事 ▲'; }
      window._stripOpen = false;
    };
  }, []);
  const d = data;
  const bl = d.bloodline;

  // Tree data: 14 people across 4 generations
  const GEN_COLORS = { blue:"#6fa8ff", pink:"#ff9bba", green:"#86E1A5", purple:"#c494ff", white:"#d0d0d0", red:"#ff8d6e" };
  const tree = {
    ggp: [
      { name:"張祖父", code:"FFF", origin:"燕地", genes:[{color:"blue",label:"武力★3"},{color:"green",label:"戰法★2"}] },
      { name:"張祖母", code:"FFM", origin:"幽州", genes:[{color:"pink",label:"統率★2"}] },
      { name:"張外祖父", code:"FMF", origin:"北境", genes:[{color:"blue",label:"武力★2"},{color:"red",label:"體魄★3"}] },
      { name:"張外祖母", code:"FMM", origin:"燕地", genes:[{color:"white",label:"天賦★1"}] },
      { name:"燕祖父", code:"MFF", origin:"南蠻", genes:[{color:"purple",label:"運氣★2"}] },
      { name:"燕祖母", code:"MFM", origin:"蠻裔", genes:[{color:"green",label:"適性★2"}] },
      { name:"燕外祖父", code:"MMF", origin:"北境", genes:[{color:"red",label:"體魄★2"}] },
      { name:"燕外祖母", code:"MMM", origin:"南蠻", genes:[{color:"pink",label:"魅力★2"}] },
    ],
    gp: [
      { name:"張父父", code:"FF", origin:"幽州", genes:[{color:"blue",label:"武力★4"},{color:"green",label:"戰法★3"}] },
      { name:"張父母", code:"FM", origin:"燕地", genes:[{color:"pink",label:"統率★3"}] },
      { name:"燕氏父", code:"MF", origin:"南蠻", genes:[{color:"purple",label:"運氣★3"},{color:"red",label:"體魄★2"}] },
      { name:"燕氏母", code:"MM", origin:"蠻裔", genes:[{color:"green",label:"適性★3"}] },
    ],
    parents: [
      { name:"張威", title:"父·幽州武人", origin:"幽州", genes:[{color:"blue",label:"武力★5"},{color:"green",label:"戰法★4"},{color:"red",label:"體魄★3"}] },
      { name:"燕氏", title:"母·燕人女將", origin:"南蠻", genes:[{color:"pink",label:"魅力★3"},{color:"purple",label:"運氣★2"}] },
    ],
  };

  function NodeCard({ person, size }) {
    const w = size === "lg" ? 120 : size === "md" ? 96 : 78;
    const fontSize = size === "lg" ? 17 : size === "md" ? 14 : 12;
    const dotSize = size === "sm" ? 7 : 8;
    return React.createElement("div", {
      style: { width:w, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }
    },
      // Avatar circle
      React.createElement("div", {
        style: { width: size==="lg"?56:size==="md"?44:36, height:size==="lg"?56:size==="md"?44:36, borderRadius:"50%",
          background:"linear-gradient(180deg,#3a2e20,#1a1612)", border:"2px solid #8A6E1F",
          display:"grid", placeItems:"center",
          fontFamily:"var(--font-headline)", fontSize:size==="lg"?22:size==="md"?17:13, color:"#FFE088", fontWeight:700,
          boxShadow:"0 2px 6px rgba(0,0,0,.5)" }
      }, person.name[0]),
      // Name
      React.createElement("span", { style:{ fontFamily:"var(--font-headline)", fontSize:fontSize, fontWeight:700, color:"#E8E4DC", letterSpacing:".05em", textAlign:"center", lineHeight:1.2 } }, person.name),
      // Origin
      person.origin && React.createElement("span", { style:{ fontFamily:"var(--font-label)", fontSize:10, color:"#6b6456", letterSpacing:".1em" } }, `(${person.origin})`),
      // Gene dots
      React.createElement("div", { style:{ display:"flex", gap:3, flexWrap:"wrap", justifyContent:"center", maxWidth:w } },
        person.genes.map((g,i)=>React.createElement("span",{key:i,style:{ width:dotSize, height:dotSize, borderRadius:dotSize/2, background:GEN_COLORS[g.color]||"#888", display:"inline-block" }}))
      ),
    );
  }

  // SVG connector lines
  const treeW = 520, treeH = 360;

  return React.createElement("div", { style:{ display:"flex", flexDirection:"column", gap:12 } },
    // EP top card
    React.createElement("div", { style:{ display:"flex", gap:14, alignItems:"stretch" } },
      React.createElement("div", { style:{ flex:1, display:"flex", alignItems:"center", gap:14, padding:"12px 16px", background:"rgba(212,175,55,.06)", border:"1px solid rgba(212,175,55,.3)", borderRadius:10 } },
        React.createElement("div", { style:{ display:"flex", flexDirection:"column", alignItems:"center", gap:2 } },
          React.createElement("span",{style:{fontFamily:"var(--font-label)",fontSize:11,color:"#B0A880",letterSpacing:".2em"}},"爆發力 EP"),
          React.createElement("span",{style:{fontFamily:"var(--font-num)",fontSize:42,fontWeight:800,color:"#FFE088",textShadow:"0 0 12px rgba(255,224,136,.3)"}},bl.ep),
        ),
        React.createElement("div",{style:{flex:1}},
          React.createElement("div",{style:{fontFamily:"var(--font-headline)",fontSize:18,color:"#FFE088",letterSpacing:".2em",marginBottom:8}},bl.epRating),
          React.createElement("div",{style:{height:10,borderRadius:5,background:"rgba(0,0,0,.2)",border:"1px solid #4D4635",overflow:"hidden"}},
            React.createElement("div",{style:{height:"100%",width:bl.ep+"%",borderRadius:5,background:"linear-gradient(90deg,#D4AF37,#FFE088)"}}),
          ),
        ),
      ),
      React.createElement("div", { style:{ display:"flex", flexDirection:"column", justifyContent:"center", gap:6, padding:"12px 16px", background:"rgba(63,106,98,.08)", border:"1px solid rgba(63,106,98,.35)", borderRadius:10, minWidth:140 } },
        React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:20,fontWeight:700,color:"#8CCFC4",letterSpacing:".2em"}},bl.name),
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:8}},
          React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:14,color:"#3F6A62"}},"覺醒傾向"),
          React.createElement("div",{style:{flex:1,height:8,borderRadius:4,background:"rgba(0,0,0,.2)",overflow:"hidden"}},
            React.createElement("div",{style:{height:"100%",width:(bl.awakening*100)+"%",borderRadius:4,background:"linear-gradient(90deg,#3F6A62,#8CCFC4)"}}),
          ),
          React.createElement("span",{style:{fontFamily:"var(--font-num)",fontSize:15,color:"#8CCFC4",fontWeight:700}},Math.round(bl.awakening*100)+"%"),
        ),
      ),
    ),

    // 14-PERSON TREE
    React.createElement(Sec, { en:"14-PERSON ANCESTRY MATRIX" }, "家族血統 · 十四人"),
    React.createElement("div", { style:{ background:"rgba(10,12,14,.6)", border:"1.5px solid #4D4635", borderRadius:10, padding:"16px 12px", position:"relative" } },
      // Generation labels (left side)
      React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:0}},

        // Row labels + nodes
        // Great-grandparents (8)
        React.createElement("div",{style:{display:"flex",alignItems:"flex-start",gap:6,marginBottom:4}},
          React.createElement("div",{style:{width:64,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",justifyContent:"flex-start",paddingTop:8}},
            React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:13,color:"#6b6456",letterSpacing:".1em",textAlign:"right"}},"曾祖父母"),
            React.createElement("span",{style:{fontFamily:"var(--font-label)",fontSize:10,color:"#4D4635",letterSpacing:".1em"}},"(8人)"),
          ),
          React.createElement("div",{style:{flex:1,display:"flex",justifyContent:"space-around"}},
            tree.ggp.map((p,i)=>React.createElement(NodeCard,{key:i,person:p,size:"sm"})),
          ),
        ),

        // SVG connector lines GGP→GP
        React.createElement("div",{style:{height:20,position:"relative",marginLeft:70}},
          React.createElement("svg",{width:"100%",height:20,viewBox:"0 0 480 20",preserveAspectRatio:"none"},
            [[0,1],[2,3],[4,5],[6,7]].map(([a,b],i)=>{
              const gapW=480/8; const ax=gapW*(a+.5), bx=gapW*(b+.5), midx=(ax+bx)/2;
              const ox=120*(i+.5);
              return React.createElement("g",{key:i,stroke:"#4D4635",strokeWidth:1.5,fill:"none"},
                React.createElement("line",{x1:ax,y1:0,x2:ax,y2:10}),
                React.createElement("line",{x1:bx,y1:0,x2:bx,y2:10}),
                React.createElement("line",{x1:ax,y1:10,x2:bx,y2:10}),
                React.createElement("line",{x1:midx,y1:10,x2:ox,y2:20}),
              );
            })
          ),
        ),

        // Grandparents (4)
        React.createElement("div",{style:{display:"flex",alignItems:"flex-start",gap:6,marginBottom:4}},
          React.createElement("div",{style:{width:64,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",justifyContent:"flex-start",paddingTop:8}},
            React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:13,color:"#6b6456",letterSpacing:".1em",textAlign:"right"}},"祖父母"),
            React.createElement("span",{style:{fontFamily:"var(--font-label)",fontSize:10,color:"#4D4635"}},"(4人)"),
          ),
          React.createElement("div",{style:{flex:1,display:"flex",justifyContent:"space-around"}},
            tree.gp.map((p,i)=>React.createElement(NodeCard,{key:i,person:p,size:"sm"})),
          ),
        ),

        // SVG GP→parents
        React.createElement("div",{style:{height:20,position:"relative",marginLeft:70}},
          React.createElement("svg",{width:"100%",height:20,viewBox:"0 0 480 20",preserveAspectRatio:"none"},
            [[0,1],[2,3]].map(([a,b],i)=>{
              const gapW=480/4; const ax=gapW*(a+.5), bx=gapW*(b+.5), midx=(ax+bx)/2;
              const ox=240*(i+.5);
              return React.createElement("g",{key:i,stroke:"#D4AF37",strokeWidth:1.5,fill:"none"},
                React.createElement("line",{x1:ax,y1:0,x2:ax,y2:10}),
                React.createElement("line",{x1:bx,y1:0,x2:bx,y2:10}),
                React.createElement("line",{x1:ax,y1:10,x2:bx,y2:10}),
                React.createElement("line",{x1:midx,y1:10,x2:ox,y2:20}),
              );
            })
          ),
        ),

        // Parents (2)
        React.createElement("div",{style:{display:"flex",alignItems:"flex-start",gap:6,marginBottom:4}},
          React.createElement("div",{style:{width:64,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",justifyContent:"flex-start",paddingTop:10}},
            React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:13,color:"#8c8575",letterSpacing:".1em",textAlign:"right"}},"父母"),
            React.createElement("span",{style:{fontFamily:"var(--font-label)",fontSize:10,color:"#6b6456"}},"(2人)"),
          ),
          React.createElement("div",{style:{flex:1,display:"flex",justifyContent:"space-around"}},
            tree.parents.map((p,i)=>React.createElement("div",{key:i,style:{display:"flex",flexDirection:"column",alignItems:"center",gap:4}},
              React.createElement(NodeCard,{person:p,size:"md"}),
              p.title && React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontStyle:"italic",fontSize:12,color:"#3F6A62",letterSpacing:".08em"}},p.title),
              React.createElement("div",{style:{display:"flex",gap:4,flexWrap:"wrap",justifyContent:"center",maxWidth:120}},
                p.genes.map((g,gi)=>React.createElement("span",{key:gi,style:{fontFamily:"var(--font-label)",fontSize:11,padding:"1px 6px",borderRadius:3,background:`${GEN_COLORS[g.color]}22`,border:`1px solid ${GEN_COLORS[g.color]}66`,color:GEN_COLORS[g.color]}},g.label))
              ),
            )),
          ),
        ),

        // SVG parents→subject
        React.createElement("div",{style:{height:20,position:"relative",marginLeft:70}},
          React.createElement("svg",{width:"100%",height:20,viewBox:"0 0 480 20",preserveAspectRatio:"none"},
            React.createElement("g",{stroke:"#FFE088",strokeWidth:2,fill:"none"},
              React.createElement("line",{x1:120,y1:0,x2:120,y2:10}),
              React.createElement("line",{x1:360,y1:0,x2:360,y2:10}),
              React.createElement("line",{x1:120,y1:10,x2:360,y2:10}),
              React.createElement("line",{x1:240,y1:10,x2:240,y2:20}),
            ),
          ),
        ),

        // Subject (張飛) — center large
        React.createElement("div",{style:{display:"flex",alignItems:"flex-start",gap:6}},
          React.createElement("div",{style:{width:64,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",justifyContent:"flex-start",paddingTop:10}},
            React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:13,color:"#FFE088",letterSpacing:".1em",textAlign:"right"}},"本代"),
            React.createElement("span",{style:{fontFamily:"var(--font-label)",fontSize:10,color:"#D4AF37"}},"(1人)"),
          ),
          React.createElement("div",{style:{flex:1,display:"flex",justifyContent:"center"}},
            React.createElement("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",gap:6}},
              React.createElement("div",{style:{width:70,height:70,borderRadius:"50%",background:"linear-gradient(180deg,#B22222,#5a0f0f)",border:"3px solid #FFE088",display:"grid",placeItems:"center",fontFamily:"var(--font-headline)",fontSize:28,color:"#FFE088",fontWeight:800,boxShadow:"0 0 20px rgba(212,175,55,.4)"}},d.name[0]),
              React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:22,fontWeight:700,color:"#FFE088",letterSpacing:".15em"}},d.name),
              React.createElement("div",{style:{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"center"}},
                [{color:"blue",label:"武力★5"},{color:"green",label:"戰法★4"},{color:"red",label:"體魄★4"},{color:"purple",label:"運氣★2",locked:true}].map((g,i)=>
                  React.createElement("span",{key:i,style:{fontFamily:"var(--font-label)",fontSize:12,padding:"2px 8px",borderRadius:4,background:g.locked?"rgba(77,70,53,.3)":`${GEN_COLORS[g.color]}22`,border:`1px solid ${g.locked?"#4D4635":GEN_COLORS[g.color]+"66"}`,color:g.locked?"#4D4635":GEN_COLORS[g.color]}},g.locked?"🔒 ???":g.label)
                ),
              ),
            ),
          ),
        ),

      ),

      // Gene legend
      React.createElement("div",{style:{marginTop:12,paddingTop:10,borderTop:"1px solid #4D4635",display:"flex",gap:14,flexWrap:"wrap"}},
        Object.entries(GEN_COLORS).map(([name,col])=>React.createElement("div",{key:name,style:{display:"flex",alignItems:"center",gap:5}},
          React.createElement("span",{style:{width:10,height:10,borderRadius:5,background:col,display:"inline-block"}}),
          React.createElement("span",{style:{fontFamily:"var(--font-label)",fontSize:11,color:col,letterSpacing:".1em"}},({blue:"藍·武力",pink:"粉·傳授",green:"綠·戰法",purple:"紫·運氣",white:"白·靈獸",red:"紅·體魄"})[name]||name),
        ))
      ),
    ),
  );
}

// ===================================================================
// TAB: EQUIPMENT (寶)
// ===================================================================
function TabEquip({ data }) {
  const d = data;
  const rarityBorder = { sr:"#2196F3", ssr:"#9C27B0", ur:"#FFC107", lr:"#D32F2F" };
  return React.createElement("div", { style:{ display:"flex", flexDirection:"column", gap:14 } },
    React.createElement(Sec, { en:"EQUIPMENT" }, "裝 備"),
    React.createElement("div", { style:{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 } },
      d.equipment.map((eq,i)=>{
        const bc = eq.rarity?(rarityBorder[eq.rarity]||"#4D4635"):"#4D4635";
        const isEmpty = !eq.name;
        return React.createElement("div",{key:i,style:{aspectRatio:"1",background:`linear-gradient(180deg,#2a2520,#1a1612)`,border:`2px solid ${bc}`,borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,position:"relative",boxShadow:isEmpty?"none":`inset 0 0 16px ${bc}22`}},
          React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:isEmpty?16:32,fontWeight:800,color:isEmpty?"#4D4635":"#FFE088"}},eq.icon),
          !isEmpty && React.createElement("span",{style:{fontFamily:"var(--font-body)",fontSize:12,color:"#D0C5AF",letterSpacing:".04em",textAlign:"center",padding:"0 6px"}},eq.name),
          !isEmpty && React.createElement("span",{style:{position:"absolute",bottom:6,right:8,fontFamily:"var(--font-num)",fontSize:14,color:"#FFE088",fontWeight:800}},`+${eq.enhance}`),
          !isEmpty && React.createElement("span",{style:{position:"absolute",top:6,left:8,fontFamily:"var(--font-label)",fontSize:10,color:bc,fontWeight:800,letterSpacing:".1em",textTransform:"uppercase"}},eq.rarity.toUpperCase()),
        );
      }),
    ),
    React.createElement(Sec, { en:"LEVEL & PROGRESS" }, "等 級"),
    React.createElement("div", { style:{ padding:"14px 16px", background:"rgba(255,255,255,.02)", border:"1px solid #4D4635", borderRadius:10 } },
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:14,marginBottom:10}},
        React.createElement("span",{style:{fontFamily:"var(--font-num)",fontSize:42,fontWeight:800,color:"#FFE088"}},"42"),
        React.createElement("span",{style:{fontFamily:"var(--font-label)",fontSize:14,color:"#B0A880"}},`/ ${d.maxLevel} MAX`),
        React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",gap:4}},
          React.createElement("div",{style:{display:"flex",justifyContent:"space-between"}},
            React.createElement("span",{style:{fontFamily:"var(--font-label)",fontSize:12,color:"#B0A880"}},"經驗值"),
            React.createElement("span",{style:{fontFamily:"var(--font-num)",fontSize:14,color:"#FFE088",fontWeight:700}},`${d.exp.toLocaleString()} / ${d.expMax.toLocaleString()}`),
          ),
          React.createElement("div",{style:{height:12,borderRadius:6,background:"rgba(0,0,0,.2)",border:"1px solid #4D4635",overflow:"hidden"}},
            React.createElement("div",{style:{height:"100%",width:Math.round(d.exp/d.expMax*100)+"%",borderRadius:6,background:"linear-gradient(90deg,#D4AF37,#FFE088)"}}),
          ),
        ),
      ),
    ),
    React.createElement(Sec, { en:"ACTIONS" }, "操 作"),
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}},
      ["升 星","突 破","培 育","評 價"].map(t=>React.createElement("button",{key:t,style:{height:54,borderRadius:10,border:"1.5px solid #8A6E1F",background:"linear-gradient(180deg,#3a2810,#20180a)",cursor:"pointer",fontFamily:"var(--font-headline)",fontSize:18,fontWeight:700,color:"#FFE088",letterSpacing:".2em",transition:"all 150ms"}},t))
    ),
  );
}

// ===================================================================
// TAB: APTITUDE (適性)
// ===================================================================
function TabAptitude({ data }) {
  const d = data;
  const GRADE_COLORS = { S:"#FFD700", A:"#86E1A5", B:"#6fa8ff", C:"#B0A880", D:"#FF6B6B" };
  function AptGroup({ title, en, items }) {
    return React.createElement("div",{style:{marginBottom:14}},
      React.createElement(Sec,{en},title),
      React.createElement("div",{style:{display:"flex",gap:8,flexWrap:"wrap"}},
        items.map((it,i)=>{
          const gc = GRADE_COLORS[it.grade]||"#B0A880";
          return React.createElement("div",{key:i,style:{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"rgba(255,255,255,.02)",border:`1.5px solid ${it.grade==="S"?gc+"66":"#4D4635"}`,borderRadius:10,minWidth:108,boxShadow:it.grade==="S"?`0 0 10px ${gc}22`:"none"}},
            React.createElement("div",{style:{width:36,height:36,borderRadius:"50%",display:"grid",placeItems:"center",background:it.grade==="S"?`radial-gradient(circle at 35% 30%,${gc},#8A6E1F)`:`${gc}18`,border:`2px solid ${gc}`,fontFamily:"var(--font-headline)",fontSize:20,fontWeight:800,color:it.grade==="S"?"#2D1E00":gc}},it.grade),
            React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:2}},
              React.createElement("span",{style:{fontFamily:"var(--font-headline)",fontSize:17,fontWeight:700,color:"#E8E4DC",letterSpacing:".1em"}},it.name),
              React.createElement("span",{style:{fontFamily:"var(--font-label)",fontSize:10,color:"#6b6456",letterSpacing:".15em"}},it.en),
            ),
          );
        }),
      ),
    );
  }
  return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:4}},
    React.createElement(AptGroup,{title:"兵種適性",en:"TROOP TYPE",items:d.aptitude.troop}),
    React.createElement(AptGroup,{title:"地形適性",en:"TERRAIN",items:d.aptitude.terrain}),
    React.createElement(AptGroup,{title:"天氣適性",en:"WEATHER",items:d.aptitude.weather}),
  );
}

const GEN_COLORS_EXPORT = { blue:"#6fa8ff", pink:"#ff9bba", green:"#86E1A5", purple:"#c494ff", white:"#d0d0d0", red:"#ff8d6e" };

Object.assign(window, { TabOverview, TabStats, TabTactics, TabBloodline, TabEquip, TabAptitude, Sec, InfoRow });
