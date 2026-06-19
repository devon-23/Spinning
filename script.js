(function(){
  "use strict";

  const API_KEY = "092d316884d8385f35ad8b84f5f42ef8";
  const API_BASE = "https://ws.audioscrobbler.com/2.0/";
  const PLACEHOLDER_HASH = "2a96cbd8b46e442fc41c2b86b821562";

  const PALETTE = ["#bf5230","#5c6b4a","#d3992f","#7a5c8a","#3f6e7a","#9c4226","#6b7f4f"];
  function colorFor(str){
    let h = 0;
    for(let i=0;i<str.length;i++){ h = str.charCodeAt(i) + ((h<<5)-h); }
    return PALETTE[Math.abs(h) % PALETTE.length];
  }
  function initial(str){
    return (str||"?").trim().charAt(0).toUpperCase() || "?";
  }

  let state = {
    user: "devonbarks",
    loaded: { overview:false, recent:false, albums:false, tracks:false, artists:false, friends:false }
  };

  async function lfm(params){
    const usp = new URLSearchParams(Object.assign({}, params, { api_key: API_KEY, format: "json" }));
    const res = await fetch(API_BASE + "?" + usp.toString());
    const data = await res.json().catch(()=>null);
    if(!data) throw new Error("Couldn't reach Last.fm.");
    if(data.error){ throw new Error(data.message || "Last.fm error."); }
    return data;
  }

  function bestImage(imgArr, size){
    if(!Array.isArray(imgArr)) return null;
    size = size || "extralarge";
    const order = ["extralarge","large","medium","small"];
    const tryOrder = [size, ...order.filter(s=>s!==size)];
    for(const sz of tryOrder){
      const found = imgArr.find(im => im.size === sz);
      if(found && found["#text"] && !found["#text"].includes(PLACEHOLDER_HASH)){
        return found["#text"];
      }
    }
    return null;
  }

  function coverHtml(imgArr, label, sizeClass, size){
    const url = bestImage(imgArr, size);
    if(url){
      return `<img class="${sizeClass||'cover'}" src="${escapeAttr(url)}" alt="" loading="lazy">`;
    }
    const bg = colorFor(label||"?");
    return `<div class="${sizeClass||'cover'} cover-fallback" style="background:${bg}">${initial(label)}</div>`;
  }

  function escapeHtml(str){
    return (str==null?"":String(str)).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  }
  function escapeAttr(str){ return escapeHtml(str); }

  function timeAgo(unixSeconds){
    const now = Math.floor(Date.now()/1000);
    let diff = now - unixSeconds;
    if(diff < 0) diff = 0;
    const mins = Math.floor(diff/60);
    if(mins < 1) return "just now";
    if(mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins/60);
    if(hrs < 24) return hrs + "h ago";
    const days = Math.floor(hrs/24);
    if(days < 7) return days + "d ago";
    const d = new Date(unixSeconds*1000);
    return d.toLocaleDateString(undefined,{month:'short',day:'numeric'});
  }

  function setStatus(el, msg){
    el.innerHTML = `<div class="state-block"><div class="groove"></div><h3>Spinning up…</h3><p>${escapeHtml(msg||"Pulling data from Last.fm.")}</p></div>`;
  }
  function setError(el, msg){
    el.innerHTML = `<div class="state-block"><h3>Scratch.</h3><p>${escapeHtml(msg)}</p></div>`;
  }
  function setEmpty(el, msg){
    el.innerHTML = `<div class="state-block"><h3>Nothing here yet</h3><p>${escapeHtml(msg)}</p></div>`;
  }

  /* ---------------- Tabs ---------------- */
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn=>{
    btn.addEventListener("click", ()=>{
      tabBtns.forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach(p=>p.classList.add("hidden"));
      const id = "tab-"+btn.dataset.tab;
      document.getElementById(id).classList.remove("hidden");
      loadTab(btn.dataset.tab);
    });
  });

  function loadTab(name){
    if(name==="overview" && !state.loaded.overview) loadOverview();
    if(name==="recent" && !state.loaded.recent) loadRecent();
    if(name==="albums" && !state.loaded.albums) loadAlbums();
    if(name==="tracks" && !state.loaded.tracks) loadTracks();
    if(name==="artists" && !state.loaded.artists) loadArtists();
    if(name==="friends" && !state.loaded.friends) loadFriends();
  }

  /* ---------------- Search ---------------- */
  document.getElementById("searchForm").addEventListener("submit", e=>{
    e.preventDefault();
    const val = document.getElementById("userInput").value.trim();
    if(!val) return;
    state.user = val;
    resetAll();
  });

  function resetAll(){
    state.loaded = { overview:false, recent:false, albums:false, tracks:false, artists:false, friends:false };
    const active = document.querySelector(".tab-btn.active").dataset.tab;
    loadTab(active);
  }

  /* ---------------- Overview ---------------- */
  async function loadOverview(){
    state.loaded.overview = true;
    const npInfo = document.getElementById("npInfo");
    const npStatus = document.getElementById("npStatus");
    const npStatusText = document.getElementById("npStatusText");
    const userStrip = document.getElementById("userStrip");
    const vinyl = document.getElementById("vinylDisc");
    const tonearm = document.getElementById("tonearm");
    const weeklyAlbums = document.getElementById("weeklyAlbums");
    const weeklyArtists = document.getElementById("weeklyArtists");
    const weeklyTracks = document.getElementById("weeklyTracks");

    npInfo.innerHTML = `<div class="np-title mono">—</div><div class="np-artist">Loading…</div>`;
    [weeklyAlbums, weeklyArtists, weeklyTracks].forEach(el=>setStatus(el,""));

    try{
      const [userData, recent] = await Promise.all([
        lfm({method:"user.getinfo", user: state.user}),
        lfm({method:"user.getrecenttracks", user: state.user, limit:1})
      ]);

      const u = userData.user;
      const displayName = u.realname && u.realname.trim() ? u.realname : u.name;
      const avatarUrl = bestImage(u.image, "large");
      userStrip.innerHTML = `
        ${avatarUrl ? `<img src="${escapeAttr(avatarUrl)}" alt="">` : `<div class="fallback-avatar" style="background:${colorFor(u.name)}">${initial(displayName)}</div>`}
        <div>
          <div class="ust-name">${escapeHtml(displayName)}</div>
          <div class="ust-meta">${Number(u.playcount||0).toLocaleString()} scrobbles${u.country && u.country!=='None' ? ' · '+escapeHtml(u.country) : ''}</div>
        </div>
      `;

      const tracks = recent.recenttracks && recent.recenttracks.track;
      const track = Array.isArray(tracks) ? tracks[0] : tracks;

      if(track){
        const isPlaying = track["@attr"] && track["@attr"].nowplaying === "true";
        const artistName = track.artist && (track.artist["#text"] || track.artist.name) || "Unknown artist";
        npInfo.innerHTML = `
          <div class="np-title">${escapeHtml(track.name||"Untitled")}</div>
          <div class="np-artist">${escapeHtml(artistName)}</div>
        `;
        const coverUrl = bestImage(track.image);
        const vDisc = document.getElementById("vinylDisc");
        vDisc.innerHTML = coverUrl
          ? `<div class="spindle"></div><img src="${escapeAttr(coverUrl)}" alt="">`
          : `<div class="spindle"></div><div class="label-fallback" style="background:${colorFor(artistName)}">${initial(artistName)}</div>`;

        if(isPlaying){
          vinyl.classList.add("spinning");
          tonearm.classList.add("down");
          npStatus.classList.remove("idle");
          npStatusText.textContent = "playing now";
        } else {
          vinyl.classList.remove("spinning");
          tonearm.classList.remove("down");
          npStatus.classList.add("idle");
          const uts = track.date && track.date.uts ? Number(track.date.uts) : null;
          npStatusText.textContent = uts ? "last spun " + timeAgo(uts) : "not currently playing";
        }
      } else {
        npInfo.innerHTML = `<div class="np-title">Quiet sleeve</div><div class="np-artist">No scrobbles yet.</div>`;
        npStatus.classList.add("idle");
        npStatusText.textContent = "silence";
      }

      const [wAlb, wArt, wTrk] = await Promise.all([
        lfm({method:"user.getweeklyalbumchart", user: state.user, limit:5}),
        lfm({method:"user.getweeklyartistchart", user: state.user, limit:5}),
        lfm({method:"user.getweeklytrackchart", user: state.user, limit:5})
      ]);

      renderWeekly(weeklyAlbums, wAlb.weeklyalbumchart && wAlb.weeklyalbumchart.album, (item)=>{
        openAlbum(item.artist["#text"]||item.artist, item.name);
      }, item => item.name, item => (item.artist && (item.artist["#text"]||item.artist)) );

      renderWeekly(weeklyArtists, wArt.weeklyartistchart && wArt.weeklyartistchart.artist, (item)=>{
        openArtist(item.name);
      }, item => item.name, ()=>null );

      renderWeekly(weeklyTracks, wTrk.weeklytrackchart && wTrk.weeklytrackchart.track, (item)=>{
        openTrack(item.artist["#text"]||item.artist, item.name);
      }, item => item.name, item => (item.artist && (item.artist["#text"]||item.artist)) );

    } catch(err){
      npInfo.innerHTML = `<div class="np-title">User not found</div><div class="np-artist">${escapeHtml(err.message)}</div>`;
      userStrip.innerHTML = "";
      [weeklyAlbums, weeklyArtists, weeklyTracks].forEach(el=>setError(el, err.message));
    }
  }

  function renderWeekly(ul, items, onClick, nameFn, subFn){
    if(!items){ setEmpty(ul, "Nothing charted this week."); return; }
    const arr = Array.isArray(items) ? items : [items];
    if(arr.length===0){ setEmpty(ul, "Nothing charted this week."); return; }
    ul.innerHTML = "";
    arr.slice(0,5).forEach((item, i)=>{
      const li = document.createElement("li");
      const sub = subFn(item);
      li.innerHTML = `<span class="rank">${i+1}</span><button class="linklike">${escapeHtml(nameFn(item))}${sub?`<br><span style="color:var(--ink-soft);font-size:11px;">${escapeHtml(sub)}</span>`:""}</button>`;
      li.querySelector("button").addEventListener("click", ()=>onClick(item));
      ul.appendChild(li);
    });
  }

  /* ---------------- Recent ---------------- */
  async function loadRecent(){
    state.loaded.recent = true;
    const list = document.getElementById("recentList");
    setStatus(list, "Pulling your recent scrobbles.");
    try{
      const data = await lfm({method:"user.getrecenttracks", user: state.user, limit:25});
      const tracks = data.recenttracks && data.recenttracks.track;
      const arr = tracks ? (Array.isArray(tracks)?tracks:[tracks]) : [];
      if(arr.length===0){ setEmpty(list, "No scrobbles found for this user."); return; }
      list.innerHTML = "";
      arr.forEach(t=>{
        const artistName = t.artist && (t.artist["#text"]||t.artist.name) || "Unknown artist";
        const isPlaying = t["@attr"] && t["@attr"].nowplaying === "true";
        const row = document.createElement("div");
        row.className = "recent-row";
        row.innerHTML = `
          ${coverHtml(t.image, artistName, "cover", "medium")}
          <div>
            <button class="title-btn rr-title">${escapeHtml(t.name)}</button>
            <div class="rr-artist"><button class="artist-btn">${escapeHtml(artistName)}</button></div>
          </div>
          <div class="rr-time ${isPlaying?'live':''}">${isPlaying ? "● now" : (t.date && t.date.uts ? timeAgo(Number(t.date.uts)) : "")}</div>
        `;
        row.querySelector(".title-btn").addEventListener("click", ()=>openTrack(artistName, t.name));
        row.querySelector(".artist-btn").addEventListener("click", ()=>openArtist(artistName));
        list.appendChild(row);
      });
    } catch(err){
      setError(list, err.message);
    }
  }

  /* ---------------- Albums ---------------- */
  async function loadAlbums(){
    state.loaded.albums = true;
    const grid = document.getElementById("albumGrid");
    setStatus(grid, "Stacking up the crate.");
    try{
      const period = document.getElementById("albumPeriod").value;
      const limit = document.getElementById("albumLimit").value;
      const data = await lfm({method:"user.gettopalbums", user: state.user, period, limit});
      const albums = data.topalbums && data.topalbums.album;
      const arr = albums ? (Array.isArray(albums)?albums:[albums]) : [];
      if(arr.length===0){ setEmpty(grid, "No albums in this range."); return; }
      grid.innerHTML = "";
      arr.forEach(a=>{
        const artistName = a.artist && (a.artist.name || a.artist["#text"]) || "Unknown artist";
        const tile = document.createElement("div");
        tile.className = "album-tile";
        tile.innerHTML = `
          ${coverHtml(a.image, a.name, "", "extralarge")}
          <div class="tile-overlay">
            <button>
              <div class="t-name">${escapeHtml(a.name)}</div>
              <div class="t-artist">${escapeHtml(artistName)}</div>
              <div class="t-plays">${Number(a.playcount||0).toLocaleString()} plays</div>
            </button>
          </div>
        `;
        tile.querySelector("button").addEventListener("click", ()=>openAlbum(artistName, a.name));
        grid.appendChild(tile);
      });
    } catch(err){
      setError(grid, err.message);
    }
  }
  document.getElementById("albumPeriod").addEventListener("change", ()=>{state.loaded.albums=false; loadAlbums();});
  document.getElementById("albumLimit").addEventListener("change", ()=>{state.loaded.albums=false; loadAlbums();});

  /* ---------------- Tracks ---------------- */
  async function loadTracks(){
    state.loaded.tracks = true;
    const list = document.getElementById("trackList");
    setStatus(list, "Cueing up your most played.");
    try{
      const period = document.getElementById("trackPeriod").value;
      const data = await lfm({method:"user.gettoptracks", user: state.user, period, limit:25});
      const tracks = data.toptracks && data.toptracks.track;
      const arr = tracks ? (Array.isArray(tracks)?tracks:[tracks]) : [];
      if(arr.length===0){ setEmpty(list, "No tracks in this range."); return; }
      const maxPlays = Math.max(...arr.map(t=>Number(t.playcount||0)), 1);
      list.innerHTML = "";
      arr.forEach((t,i)=>{
        const artistName = t.artist && (t.artist.name || t.artist["#text"]) || "Unknown artist";
        const plays = Number(t.playcount||0);
        const row = document.createElement("div");
        row.className = "rank-row";
        row.innerHTML = `
          <div class="rank-num mono">${i+1}</div>
          ${coverHtml(t.image, t.name, "cover", "medium")}
          <div class="rr-main">
            <button class="title-btn">${escapeHtml(t.name)}</button>
            <div class="rr-sub">${escapeHtml(artistName)}</div>
          </div>
          <div class="bar-wrap"><div class="bar-track"><div class="bar-fill" style="width:${Math.round(plays/maxPlays*100)}%"></div></div></div>
          <div class="plays mono">${plays.toLocaleString()} plays</div>
        `;
        row.querySelector(".title-btn").addEventListener("click", ()=>openTrack(artistName, t.name));
        list.appendChild(row);
      });
    } catch(err){
      setError(list, err.message);
    }
  }
  document.getElementById("trackPeriod").addEventListener("change", ()=>{state.loaded.tracks=false; loadTracks();});

  /* ---------------- Artists ---------------- */
  async function loadArtists(){
    state.loaded.artists = true;
    const list = document.getElementById("artistList");
    setStatus(list, "Sorting the shelf by plays.");
    try{
      const period = document.getElementById("artistPeriod").value;
      const data = await lfm({method:"user.gettopartists", user: state.user, period, limit:25});
      const artists = data.topartists && data.topartists.artist;
      const arr = artists ? (Array.isArray(artists)?artists:[artists]) : [];
      if(arr.length===0){ setEmpty(list, "No artists in this range."); return; }
      const maxPlays = Math.max(...arr.map(a=>Number(a.playcount||0)), 1);
      list.innerHTML = "";
      arr.forEach((a,i)=>{
        const plays = Number(a.playcount||0);
        const row = document.createElement("div");
        row.className = "rank-row";
        row.innerHTML = `
          <div class="rank-num mono">${i+1}</div>
          ${coverHtml(a.image, a.name, "cover", "medium")}
          <div class="rr-main">
            <button class="title-btn">${escapeHtml(a.name)}</button>
            <div class="rr-sub">${a.tagcount ? a.tagcount + " tags" : "artist"}</div>
          </div>
          <div class="bar-wrap"><div class="bar-track"><div class="bar-fill" style="width:${Math.round(plays/maxPlays*100)}%"></div></div></div>
          <div class="plays mono">${plays.toLocaleString()} plays</div>
        `;
        row.querySelector(".title-btn").addEventListener("click", ()=>openArtist(a.name));
        list.appendChild(row);
      });
    } catch(err){
      setError(list, err.message);
    }
  }
  document.getElementById("artistPeriod").addEventListener("change", ()=>{state.loaded.artists=false; loadArtists();});

  /* ---------------- Friends ---------------- */
  async function loadFriends(){
    state.loaded.friends = true;
    const grid = document.getElementById("friendGrid");
    const meta = document.getElementById("friendsMeta");
    setStatus(grid, "Looking through the address book.");
    meta.textContent = "";
    try{
      const data = await lfm({method:"user.getfriends", user: state.user, limit:50});
      const friends = data.friends && data.friends.user;
      const arr = friends ? (Array.isArray(friends)?friends:[friends]) : [];
      if(arr.length===0){ setEmpty(grid, "No friends listed for this user."); return; }
      meta.textContent = arr.length + " friend" + (arr.length===1?"":"s");
      grid.innerHTML = "";
      arr.forEach(f=>{
        const card = document.createElement("div");
        card.className = "friend-card";
        card.innerHTML = `<button>${coverHtml(f.image, f.name, "", "medium")}<div class="f-name">${escapeHtml(f.name)}</div></button>`;
        card.querySelector("button").addEventListener("click", ()=>{
          document.getElementById("userInput").value = f.name;
          state.user = f.name;
          tabBtns.forEach(b=>b.classList.remove("active"));
          document.querySelector('[data-tab="overview"]').classList.add("active");
          document.querySelectorAll(".tab-panel").forEach(p=>p.classList.add("hidden"));
          document.getElementById("tab-overview").classList.remove("hidden");
          resetAll();
        });
        grid.appendChild(card);
      });
    } catch(err){
      setError(grid, err.message);
    }
  }

  /* ---------------- Modal: Artist / Album / Track ---------------- */
  const modalOverlay = document.getElementById("modalOverlay");
  const modalInner = document.getElementById("modalInner");
  document.getElementById("modalClose").addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", e=>{ if(e.target===modalOverlay) closeModal(); });
  document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeModal(); });

  function openModal(){ modalOverlay.classList.remove("hidden"); document.body.style.overflow="hidden"; }
  function closeModal(){ modalOverlay.classList.add("hidden"); document.body.style.overflow=""; }

  function trimSummary(summary){
    if(!summary) return "";
    const cut = summary.indexOf("<a");
    let text = cut>-1 ? summary.slice(0,cut) : summary;
    const div = document.createElement("div");
    div.innerHTML = text;
    return div.textContent.trim();
  }

  async function openArtist(name){
    
    modalInner.innerHTML = "";
    setStatus(modalInner, "Reading the liner notes.");
    openModal();
    try{
      const data = await lfm({method:"artist.getinfo", artist:name, autocorrect:1});
      const a = data.artist;
      const artistImage = await getWikipediaArtistImage(a.name);
      const img = artistImage || bestImage(a.image, "extralarge");
      const bio = trimSummary(a.bio && a.bio.summary);
      const listeners = a.stats ? Number(a.stats.listeners||0).toLocaleString() : "—";
      const playcount = a.stats ? Number(a.stats.playcount||0).toLocaleString() : "—";
      modalInner.innerHTML = `
        <div class="modal-hero">
          ${img ? `<img src="${escapeAttr(img)}" alt="">` : `<div class="cover-fallback" style="background:${colorFor(a.name)}">${initial(a.name)}</div>`}
          <div>
            <div class="eyebrow">Artist</div>
            <h2>${escapeHtml(a.name)}</h2>
            <div class="sub">${a.tags && a.tags.tag ? (Array.isArray(a.tags.tag)?a.tags.tag:[a.tags.tag]).slice(0,4).map(t=>t.name).join(" · ") : ""}</div>
          </div>
        </div>
        <div class="modal-body">
          <div class="modal-stat-row">
            <div class="modal-stat"><div class="num">${listeners}</div><div class="lbl">listeners</div></div>
            <div class="modal-stat"><div class="num">${playcount}</div><div class="lbl">scrobbles</div></div>
          </div>
          <p class="bio">${escapeHtml(bio) || "No biography available for this artist yet."}</p>
        </div>
      `;
    } catch(err){
      setError(modalInner, err.message);
    }
  }

  async function getWikipediaArtistImage(artist) {
    const searchUrl =
        `https://en.wikipedia.org/w/api.php` +
        `?action=query` +
        `&list=search` +
        `&srsearch=${encodeURIComponent(artist)}` +
        `&format=json` +
        `&origin=*`;

    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();

    if (!searchData.query?.search?.length) {
        return null;
    }

    const pageTitle = searchData.query.search[0].title;

    return await getWikipediaPageImage(pageTitle);
}

async function getWikipediaPageImage(title) {
    const pageUrl =
        `https://en.wikipedia.org/w/api.php` +
        `?action=query` +
        `&titles=${encodeURIComponent(title)}` +
        `&prop=pageimages` +
        `&piprop=original` +
        `&format=json` +
        `&origin=*`;

    const response = await fetch(pageUrl);
    const data = await response.json();

    const pages = data.query?.pages;

    if (!pages) return null;

    const page = Object.values(pages)[0];

    return page.original?.source || null;
}

  async function openAlbum(artist, album){
    modalInner.innerHTML = "";
    setStatus(modalInner, "Flipping the sleeve over.");
    openModal();
    try{
      const data = await lfm({method:"album.getinfo", artist, album, autocorrect:1});
      const a = data.album;
      const img = bestImage(a.image, "extralarge");
      const bio = trimSummary(a.wiki && a.wiki.summary);
      const tracksRaw = a.tracks && a.tracks.track;
      const tracks = tracksRaw ? (Array.isArray(tracksRaw)?tracksRaw:[tracksRaw]) : [];
      const rows = tracks.map((t,i)=>{
        const dur = Number(t.duration||0);
        const mm = Math.floor(dur/60), ss = String(dur%60).padStart(2,"0");
        return `<tr><td>${i+1}</td><td>${escapeHtml(t.name)}</td><td>${dur?`${mm}:${ss}`:"—"}</td></tr>`;
      }).join("");
      modalInner.innerHTML = `
        <div class="modal-hero">
          ${img ? `<img src="${escapeAttr(img)}" alt="">` : `<div class="cover-fallback" style="background:${colorFor(a.name)}">${initial(a.name)}</div>`}
          <div>
            <div class="eyebrow">Album</div>
            <h2>${escapeHtml(a.name)}</h2>
            <div class="sub"><button class="title-btn" id="albumArtistLink" style="background:none;border:none;font-family:inherit;font-size:14px;color:inherit;cursor:pointer;padding:0;">${escapeHtml(a.artist)}</button></div>
          </div>
        </div>
        <div class="modal-body">
          ${a.playcount ? `<div class="modal-stat-row"><div class="modal-stat"><div class="num">${Number(a.playcount).toLocaleString()}</div><div class="lbl">scrobbles</div></div></div>` : ""}
          ${tracks.length ? `<table class="tracklist">${rows}</table>` : ""}
          ${bio ? `<p class="bio" style="margin-top:14px;">${escapeHtml(bio)}</p>` : ""}
        </div>
      `;
      const link = document.getElementById("albumArtistLink");
      if(link) link.addEventListener("click", ()=>openArtist(a.artist));
    } catch(err){
      setError(modalInner, err.message);
    }
  }

  async function openTrack(artist, track){
    modalInner.innerHTML = "";
    setStatus(modalInner, "Checking the run-out groove.");
    openModal();
    try{
      const data = await lfm({method:"track.getInfo", artist, track, username: state.user, autocorrect:1});
      const t = data.track;
      const album = t.album;
      const img = album ? bestImage(album.image, "extralarge") : null;
      const bio = trimSummary(t.wiki && t.wiki.summary);
      modalInner.innerHTML = `
        <div class="modal-hero">
          ${img ? `<img src="${escapeAttr(img)}" alt="">` : `<div class="cover-fallback" style="background:${colorFor(t.name)}">${initial(t.name)}</div>`}
          <div>
            <div class="eyebrow">Track</div>
            <h2>${escapeHtml(t.name)}</h2>
            <div class="sub"><button class="title-btn" id="trackArtistLink" style="background:none;border:none;font-family:inherit;font-size:14px;color:inherit;cursor:pointer;padding:0;">${escapeHtml(t.artist && t.artist.name)}</button>${album?` · ${escapeHtml(album.title)}`:""}</div>
          </div>
        </div>
        <div class="modal-body">
          <div class="modal-stat-row">
            <div class="modal-stat"><div class="num">${t.userplaycount!=null ? Number(t.userplaycount).toLocaleString() : "—"}</div><div class="lbl">${escapeHtml(state.user)}'s plays</div></div>
            <div class="modal-stat"><div class="num">${t.listeners ? Number(t.listeners).toLocaleString() : "—"}</div><div class="lbl">listeners</div></div>
          </div>
          ${bio ? `<p class="bio">${escapeHtml(bio)}</p>` : `<p class="scratch-note">No write-up for this track yet.</p>`}
        </div>
      `;
      const link = document.getElementById("trackArtistLink");
      if(link) link.addEventListener("click", ()=>openArtist(t.artist && t.artist.name));
    } catch(err){
      setError(modalInner, err.message);
    }
  }

  /* ---------------- init ---------------- */
  document.getElementById("userInput").value = state.user;
  loadOverview();
})();