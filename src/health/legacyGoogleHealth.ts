// @ts-nocheck
/**
 * Google Health sync — a VERBATIM port of the module in `legacy/AbdQuest.html`
 * (lines 682-1000), which is the version that actually worked on Abdelrahman's
 * phone.
 *
 * Do not refactor, retype or "clean up" the code below. Every fallback order in
 * GH_METRICS, every magic minimum and every alternative request shape was found
 * by trial against the real API on a real device. A previous attempt to improve
 * this module deleted his stored credentials and broke sign-in, and no revert
 * could bring them back — so this file changes only in ways that can be proven
 * on his device.
 *
 * It keeps the ORIGINAL localStorage keys (`abdquest_gh`, `abdquest_gh_cid`,
 * `abdquest_gh_csec`, `abdquest_gh_strat`, `abdquest_gh_types`). A connection
 * made in either app therefore works in both, and nothing here ever clears them
 * except `disconnect()`, which only runs when the user taps Disconnect.
 *
 * ONE deliberate deviation from the original, recorded here so the "verbatim"
 * claim above stays honest: the auth URL asks for `prompt=select_account consent`
 * rather than `prompt=consent`. Without select_account, a browser already signed
 * into a Google account uses it silently with no chooser — which sent Abd into
 * his university account with no way to pick his personal one. It changes which
 * account you are offered, nothing about the token exchange or the data calls.
 *
 * `@ts-nocheck` is deliberate: the typed boundary lives in ./index.ts, so the
 * rest of the app is type-safe without a single line of this being rewritten.
 */

// GOOGLE HEALTH SYNC MODULE (Google Health API v4 — serves Fitbit device data; replaces legacy Fitbit Web API)
var FB_KEY='abdquest_gh';
function fbGet(){try{return JSON.parse(localStorage.getItem(FB_KEY)||'null');}catch(e){return null;}}
function fbSet(v){try{if(v)localStorage.setItem(FB_KEY,JSON.stringify(v));else localStorage.removeItem(FB_KEY);}catch(e){}}
function fbRedirectUri(){return location.origin+location.pathname;}
function fbConnect(clientId,clientSecret){
  try{
    var stt=Math.random().toString(36).slice(2);
    sessionStorage.setItem('gh_state',stt);sessionStorage.setItem('gh_cid',clientId);sessionStorage.setItem('gh_csec',clientSecret);
    try{localStorage.setItem('abdquest_gh_cid',clientId);localStorage.setItem('abdquest_gh_csec',clientSecret);}catch(e){}
    var scopes=['https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly','https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly','https://www.googleapis.com/auth/googlehealth.sleep.readonly','https://www.googleapis.com/auth/googlehealth.nutrition.readonly'];
    location.href='https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id='+encodeURIComponent(clientId)+'&redirect_uri='+encodeURIComponent(fbRedirectUri())+'&scope='+encodeURIComponent(scopes.join(' '))+'&access_type=offline&prompt=select_account%20consent&state='+stt;
  }catch(e){alert('Could not start Google Health connect: '+e.message);}
}
function fbToken(params,cb){
  var body=Object.keys(params).map(function(k){return k+'='+encodeURIComponent(params[k]);}).join('&');
  fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body})
    .then(function(r){return r.json();}).then(cb).catch(function(){cb(null);});
}
function fbHandleRedirect(cb){
  var m=location.search.match(/[?&]code=([^&#]+)/);
  if(!m)return cb(false,null);
  var code=decodeURIComponent(m[1]);
  var sm=location.search.match(/[?&]state=([^&#]+)/);
  var cid=sessionStorage.getItem('gh_cid')||localStorage.getItem('abdquest_gh_cid');
  var csec=sessionStorage.getItem('gh_csec')||localStorage.getItem('abdquest_gh_csec');
  var expState=sessionStorage.getItem('gh_state');
  try{history.replaceState(null,'',location.pathname);}catch(e){}
  if(expState&&sm&&decodeURIComponent(sm[1])!==expState)return cb(false,'state mismatch — please tap Connect again');
  if(!cid||!csec)return cb(false,'missing credentials — please tap Connect again');
  fbToken({code:code,client_id:cid,client_secret:csec,redirect_uri:fbRedirectUri(),grant_type:'authorization_code'},function(d){
    if(d&&d.access_token){fbSet({cid:cid,csec:csec,at:d.access_token,rt:d.refresh_token||null,exp:Date.now()+((d.expires_in||3600)*1000)});cb(true,null);}
    else cb(false,(d&&(d.error_description||d.error))||'token exchange failed — check Client ID/Secret & redirect URL');
  });
}
function fbEnsureToken(cb){
  var t=fbGet();if(!t)return cb(null);
  if(Date.now()<t.exp-60000)return cb(t.at);
  if(!t.rt)return cb(null);
  fbToken({client_id:t.cid,client_secret:t.csec,refresh_token:t.rt,grant_type:'refresh_token'},function(d){
    if(d&&d.access_token){t.at=d.access_token;if(d.refresh_token)t.rt=d.refresh_token;t.exp=Date.now()+((d.expires_in||3600)*1000);fbSet(t);cb(t.at);}
    else cb(null);
  });
}
function ghReq(method,path,at,body,cb){
  var o={method:method,headers:{'Authorization':'Bearer '+at,'Accept':'application/json'}};
  if(body){o.headers['Content-Type']='application/json';o.body=JSON.stringify(body);}
  fetch('https://health.googleapis.com/v4'+path,o).then(function(r){return r.ok?r.json():null;}).then(cb).catch(function(){cb(null);});
}
function ghCivil(dateKey,hh,mm,ss){var p=dateKey.split('-');return {date:{year:+p[0],month:+p[1],day:+p[2]},time:{hours:hh,minutes:mm,seconds:ss,nanos:0}};}
function ghNum(o,depth){if(o==null||depth>4)return 0;if(typeof o==='number')return o;if(typeof o==='string'){var f=parseFloat(o);return isNaN(f)?0:f;}if(typeof o==='object'){for(var k in o){if(!o.hasOwnProperty(k))continue;if(k==='civilStartTime'||k==='civilEndTime'||k==='startTime'||k==='endTime')continue;var v=ghNum(o[k],(depth||0)+1);if(v)return v;}}return 0;}
function ghDailySum(type,dateKey,at,cb){
  ghReq('POST','/users/me/dataTypes/'+type+'/dataPoints:dailyRollUp',at,{range:{start:ghCivil(dateKey,0,0,0),end:ghCivil(dateKey,23,59,59)},windowSizeDays:1},function(d){
    try{var rp=d.rollupDataPoints[0];var c=Object.assign({},rp);delete c.civilStartTime;delete c.civilEndTime;cb(ghNum(c,0));}catch(e){cb(0);}
  });
}
function ghReqE(method,path,at,body,cb){
  var o={method:method,headers:{'Authorization':'Bearer '+at,'Accept':'application/json'}};
  if(body){o.headers['Content-Type']='application/json';o.body=JSON.stringify(body);}
  fetch('https://health.googleapis.com/v4'+path,o).then(function(r){
    return r.text().then(function(t){var j=null;try{j=JSON.parse(t);}catch(e){}
      if(r.ok)cb(true,j,r.status,'');
      else{var msg='';try{msg=j.error.message||'';}catch(e2){msg=String(t).slice(0,120);}cb(false,null,r.status,msg);}
    });
  }).catch(function(e){cb(false,null,0,'network: '+e.message);});
}
function ghRfc(d){return d.toISOString().replace(/\.\d{3}Z$/,'Z');}
function ghDayRangeZ(dateKey){var p=dateKey.split('-');var d0=new Date(+p[0],+p[1]-1,+p[2],0,0,0),d1=new Date(+p[0],+p[1]-1,+p[2],23,59,59);return [ghRfc(d0),ghRfc(d1)];}
var GH_STRAT=(function(){try{return JSON.parse(localStorage.getItem('abdquest_gh_strat')||'{}');}catch(e){return {};}})();
function ghStratSave(){try{localStorage.setItem('abdquest_gh_strat',JSON.stringify(GH_STRAT));}catch(e){}}
var GH_METRICS={
  calOut:{type:'total-calories',camel:'totalCalories',snake:'total_calories',order:['roll','listI'],min:200},
  calOut2:{type:'active-energy-burned',camel:'activeEnergyBurned',snake:'active_energy_burned',order:['roll','listI'],min:5},
  azm:{type:'active-zone-minutes',camel:'activeZoneMinutes',snake:'active_zone_minutes',order:['roll','listAll'],min:1},
  rhr:{type:'daily-resting-heart-rate',camel:'dailyRestingHeartRate',snake:'daily_resting_heart_rate',order:['listAll'],min:25,max:200,agg:'avg'},
  hrAvg:{type:'heart-rate',camel:'heartRate',snake:'heart_rate',order:['listS'],min:25,max:230,agg:'avg',cap:1},
  calIn:{types:['nutrition-logs','food-logs','nutrition-log','food-log','nutrition-summary','foods'],catRe:'nutrition|food',camel:'nutrition',order:['roll','listI','listDR'],min:50},
  hrv:{type:'heart-rate-variability',camel:'heartRateVariability',snake:'heart_rate_variability',order:['listS1'],min:3,max:250,agg:'avg'},
  resp:{type:'respiratory-rate-sleep-summary',camel:'respiratoryRateSleepSummary',snake:'respiratory_rate_sleep_summary',order:['listS1','listAll'],min:4,max:40,agg:'avg'},
  spo2:{type:'oxygen-saturation',camel:'oxygenSaturation',snake:'oxygen_saturation',order:['listS1'],min:70,max:100,agg:'avg'},
  vo2max:{type:'daily-vo2-max',camel:'dailyVo2Max',snake:'daily_vo2_max',order:['listAll'],min:10,max:90,agg:'avg'}
};
function ghTypesCached(){try{return JSON.parse(localStorage.getItem('abdquest_gh_types')||'[]');}catch(e){return [];}}
function ghCatalog(at,cb){
  var urls=['/users/me/dataTypes?pageSize=400','/users/me/dataTypes','/dataTypes?pageSize=400','/users/me/dataSources','/users/me/dataTypes:list'];
  var notes=[];
  (function tryU(i){
    if(i>=urls.length)return cb([],notes.join(' | '));
    ghReqE('GET',urls[i],at,null,function(ok,d,stt,err){
      if(!ok){notes.push(urls[i].split('?')[0]+': '+stt+' '+(err||'').slice(0,40));return tryU(i+1);}
      try{
        var raw=d.dataTypes||d.dataTypeList||d.types||d.dataSources||d.dataSource||[];
        if(!Array.isArray(raw)&&typeof raw==='object')raw=Object.keys(raw);
        var ids=(raw||[]).map(function(t){return (typeof t==='string')?t:(t.id||t.name||t.dataTypeId||t.dataType||'');}).filter(Boolean).map(function(x){return String(x).split('/').pop();});
        if(ids.length){try{localStorage.setItem('abdquest_gh_types',JSON.stringify(ids));}catch(e){}return cb(ids,'via '+urls[i].split('?')[0]);}
        notes.push(urls[i].split('?')[0]+': keys '+JSON.stringify(Object.keys(d||{})).slice(0,50));tryU(i+1);
      }catch(e){notes.push(urls[i].split('?')[0]+': parse');tryU(i+1);}
    });
  })(0);
}
function ghMetricOne(metric,type,dateKey,at,cb){
  var camel=metric.camel,snake=type.replace(/-/g,'_');
  var R=ghDayRangeZ(dateKey);
  function clean(dp,drop){var c=Object.assign({},dp[camel]||dp);(drop||[]).forEach(function(k){delete c[k];});return c;}
  var methods={
    listDR:function(done){var f=encodeURIComponent(snake+'.date >= "'+dateKey+'" AND '+snake+'.date <= "'+dateKey+'"');ghReqE('GET','/users/me/dataTypes/'+type+'/dataPoints?filter='+f,at,null,function(ok,d,stt,err){if(!ok)return done(0,stt+' '+err);try{var dp=(d.dataPoints||[])[0];if(!dp)return done(0,'no points');done(ghNum(clean(dp,['date']),0),'');}catch(e){done(0,'parse');}});},
    listAll:function(done){ghReqE('GET','/users/me/dataTypes/'+type+'/dataPoints?pageSize=14',at,null,function(ok,d,stt,err){if(!ok)return done(0,stt+' '+err);try{var pts=d.dataPoints||[];if(!pts.length)return done(0,'no points');var match=null;pts.forEach(function(dp){var dt=(dp[camel]&&dp[camel].date)||dp.date;if(dt){var k=dt.year+'-'+String(dt.month).padStart(2,'0')+'-'+String(dt.day).padStart(2,'0');if(k===dateKey)match=dp;}});var use=match||pts[pts.length-1];done(ghNum(clean(use,['date']),0),match?'':'latest');}catch(e){done(0,'parse');}});},
    roll:function(done){ghReqE('POST','/users/me/dataTypes/'+type+'/dataPoints:dailyRollUp',at,{range:{start:ghCivil(dateKey,0,0,0),end:ghCivil(dateKey,23,59,59)},windowSizeDays:1},function(ok,d,stt,err){if(!ok)return done(0,stt+' '+err);try{var rp=d.rollupDataPoints[0];var c=Object.assign({},rp);delete c.civilStartTime;delete c.civilEndTime;done(ghNum(c,0),'');}catch(e){done(0,'empty');}});},
    listI:function(done){var f=encodeURIComponent(snake+'.interval.end_time >= "'+R[0]+'" AND '+snake+'.interval.end_time <= "'+R[1]+'"');ghReqE('GET','/users/me/dataTypes/'+type+'/dataPoints?filter='+f,at,null,function(ok,d,stt,err){if(!ok)return done(0,stt+' '+err);try{var sum=0,n=0;(d.dataPoints||[]).forEach(function(dp){var v=ghNum(clean(dp,['interval']),0);if(v>0){sum+=v;n++;}});if(!n)return done(0,'no points');done(metric.agg==='avg'?Math.round(sum/n):sum,'');}catch(e){done(0,'parse');}});},
    listD:function(done){var f=encodeURIComponent(snake+'.date = "'+dateKey+'"');ghReqE('GET','/users/me/dataTypes/'+type+'/dataPoints?filter='+f,at,null,function(ok,d,stt,err){if(!ok)return done(0,stt+' '+err);try{var dp=(d.dataPoints||[])[0];if(!dp)return done(0,'no points');done(ghNum(clean(dp,['date']),0),'');}catch(e){done(0,'parse');}});},
    listS:function(done){var f=encodeURIComponent(snake+'.sample_time.physical_time >= "'+R[0]+'" AND '+snake+'.sample_time.physical_time <= "'+R[1]+'"');ghReqE('GET','/users/me/dataTypes/'+type+'/dataPoints?filter='+f,at,null,function(ok,d,stt,err){if(!ok)return done(0,stt+' '+err);try{var sum=0,n=0;(d.dataPoints||[]).slice(0,800).forEach(function(dp){var v=ghNum(clean(dp,['sampleTime']),0);if(v>0&&(!metric.max||v<=metric.max)){sum+=v;n++;}});if(!n)return done(0,'no points');done(metric.agg==='avg'?Math.round(sum/n):sum,'');}catch(e){done(0,'parse');}});},
    listS1:function(done){var f=encodeURIComponent(snake+'.sample_time.physical_time >= "'+R[0]+'"');ghReqE('GET','/users/me/dataTypes/'+type+'/dataPoints?filter='+f+'&pageSize=1000',at,null,function(ok,d,stt,err){if(!ok)return done(0,stt+' '+String(err||'').slice(0,40));try{var vals=[];(d.dataPoints||[]).forEach(function(dp){var c=Object.assign({},dp[camel]||dp);var ts=c.sampleTime;delete c.sampleTime;var when=null;try{when=new Date((ts&&(ts.physicalTime||ts.endTime))||ts);}catch(e){}if(when&&!isNaN(when)){var wk=when.getFullYear()+'-'+String(when.getMonth()+1).padStart(2,'0')+'-'+String(when.getDate()).padStart(2,'0');if(wk!==dateKey)return;}var v=ghNum(c,0);if(v>0&&(!metric.min||v>=metric.min)&&(!metric.max||v<=metric.max))vals.push(v);});if(!vals.length)return done(0,'no points');done(metric.agg==='sum'?vals.reduce(function(a,b){return a+b;},0):Math.round(vals.reduce(function(a,b){return a+b;},0)/vals.length*10)/10,'');}catch(e){done(0,'parse');}});},
  };
  var order=metric.order.slice();
  var cached=GH_STRAT[type];
  if(cached&&order.indexOf(cached)>=0)order=[cached].concat(order.filter(function(x){return x!==cached;}));
  var notes=[];
  (function next(i){
    if(i>=order.length)return cb(0,notes.join(' | ')||'all empty');
    var fn=methods[order[i]];
    if(!fn)return next(i+1);
    fn(function(v,note){
      if(note)notes.push(order[i]+': '+note);
      var pass=v>0&&(!metric.min||v>=metric.min)&&(!metric.max||v<=metric.max);
      if(pass){GH_STRAT[type]=order[i];ghStratSave();return cb(Math.round(v),order[i]);}
      next(i+1);
    });
  })(0);
}
function ghMetric(key,dateKey,at,cb){
  var metric=GH_METRICS[key];if(!metric)return cb(0,'unknown');
  var types=metric.types?metric.types.slice():[metric.type];
  if(metric.catRe){
    var rx=new RegExp(metric.catRe,'i');
    var fromCat=ghTypesCached().filter(function(t){return rx.test(t)&&types.indexOf(t)<0;});
    types=fromCat.concat(types);
  }
  var savedType=GH_STRAT['type:'+key];
  if(savedType&&types.indexOf(savedType)>=0)types=[savedType].concat(types.filter(function(x){return x!==savedType;}));
  var allNotes=[];
  (function nextT(j){
    if(j>=types.length)return cb(0,allNotes.join(' || ')||'all empty');
    ghMetricOne(metric,types[j],dateKey,at,function(v,note){
      if(v>0){GH_STRAT['type:'+key]=types[j];ghStratSave();return cb(v,types[j]+' '+note);}
      if(note)allNotes.push(types[j]+': '+note);
      nextT(j+1);
    });
  })(0);
}
function ghSleepDay(dateKey,at,cb){
  var filter=encodeURIComponent('sleep.interval.civil_end_time >= "'+dateKey+'"');
  ghReq('GET','/users/me/dataTypes/sleep/dataPoints?filter='+filter,at,null,function(d){
    try{
      var best=null;
      function hmC(ct){try{var t=ct.time||{};return String(t.hours||0).padStart(2,'0')+':'+String(t.minutes||0).padStart(2,'0');}catch(e){return null;}}
      function hmP(iso){try{var dt=new Date(iso);if(isNaN(dt))return null;return String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');}catch(e){return null;}}
      (d.dataPoints||[]).forEach(function(dp){
        var s=dp.sleep;if(!s)return;
        var ce=s.interval&&s.interval.civilEndTime&&s.interval.civilEndTime.date;
        if(ce){var k=ce.year+'-'+String(ce.month).padStart(2,'0')+'-'+String(ce.day).padStart(2,'0');if(k!==dateKey)return;}
        var sm=s.summary||{};
        var mins=parseFloat(sm.minutesAsleep)||0;
        if(!mins&&s.interval){try{mins=Math.round((new Date(s.interval.endTime)-new Date(s.interval.startTime))/60000);}catch(e){}}
        var isMain=s.metadata&&s.metadata.main;
        var start=(s.interval&&s.interval.civilStartTime?hmC(s.interval.civilStartTime):null)||(s.interval?hmP(s.interval.startTime):null);
        var end=(s.interval&&s.interval.civilEndTime?hmC(s.interval.civilEndTime):null)||(s.interval?hmP(s.interval.endTime):null);
        var stages={};
        function grab(obj){if(!obj||typeof obj!=='object')return;for(var k2 in obj){if(!obj.hasOwnProperty(k2))continue;var kl=k2.toLowerCase();var v=obj[k2];var num=(typeof v==='object'&&v)?ghNum(v,0):parseFloat(v);
          if(isNaN(num)||num<=0)continue;
          if(kl.indexOf('deep')>=0)stages.deep=(stages.deep||0)+Math.round(num);
          else if(kl.indexOf('rem')>=0)stages.rem=(stages.rem||0)+Math.round(num);
          else if(kl.indexOf('light')>=0)stages.light=(stages.light||0)+Math.round(num);
          else if(kl.indexOf('awake')>=0||kl.indexOf('wake')>=0)stages.awake=(stages.awake||0)+Math.round(num);
          else if(kl.indexOf('restless')>=0)stages.restless=(stages.restless||0)+Math.round(num);
        }}
        grab(sm);if(sm.stages)grab(sm.stages);if(s.stages)grab(s.stages);
        var seq=null;
        try{
          var lv=(s.levels&&(s.levels.data||s.levels))||s.stageData||null;
          if(Array.isArray(lv)&&lv.length){
            seq=[];
            lv.slice(0,60).forEach(function(seg){
              var lvl2=String(seg.level||seg.stage||seg.type||'').toLowerCase();
              var m=Math.round((parseFloat(seg.seconds)||0)/60)||Math.round(parseFloat(seg.minutes)||0);
              if(lvl2&&m>0)seq.push([lvl2.indexOf('deep')>=0?'deep':lvl2.indexOf('rem')>=0?'rem':lvl2.indexOf('wake')>=0||lvl2.indexOf('awake')>=0?'awake':lvl2.indexOf('restless')>=0?'restless':'light',m]);
            });
            if(!seq.length)seq=null;
          }
        }catch(e){}
        if(isMain||!best||mins>best.mins){best={mins:mins,start:start,end:end,stages:Object.keys(stages).length?stages:null,seq:seq,main:!!isMain};}
      });
      if(best&&best.mins>0)cb({hrs:Math.round(best.mins/6)/10,start:best.start,end:best.end,stages:best.stages,seq:best.seq});else cb(null);
    }catch(e){cb(null);}
  });
}
function ghRhrDay(dateKey,at,cb){
  var filter=encodeURIComponent('daily_resting_heart_rate.date = "'+dateKey+'"');
  ghReq('GET','/users/me/dataTypes/daily-resting-heart-rate/dataPoints?filter='+filter,at,null,function(d){
    try{var dp=(d.dataPoints||[])[0];if(!dp)return cb(0);var c=Object.assign({},dp.dailyRestingHeartRate||dp);delete c.date;cb(ghNum(c,0));}catch(e){cb(0);}
  });
}
function ghPretty(k){return String(k).replace(/[_-]/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').toLowerCase().replace(/^./,function(c){return c.toUpperCase();});}
function ghExercisesDay(dateKey,at,cb){
  var p=dateKey.split('-');
  var d0=new Date(+p[0],+p[1]-1,+p[2],0,0,0),d1=new Date(+p[0],+p[1]-1,+p[2],23,59,59);
  ghReqE('GET','/users/me/dataTypes/exercise/dataPoints?pageSize=40',at,null,function(ok,d,stt,err){
    if(!ok)return cb(null,stt+' '+String(err||'').slice(0,50));
    try{
      var list=[];
      (d.dataPoints||[]).forEach(function(dp){
        var ex=dp.exercise||(function(){for(var kk in dp){if(dp.hasOwnProperty(kk)&&typeof dp[kk]==='object'&&kk!=='interval')return dp[kk];}return null;})();if(!ex)return;
        var name=ex.activityType||ex.activityName||ex.name||'Workout';
        name=ghPretty(name);
        var ivl=ex.interval||dp.interval||{};
        var dur=0,startHM='',key=''+list.length,startDay='';
        try{var st2=new Date(ivl.startTime),en=new Date(ivl.endTime);dur=Math.round((en-st2)/60000);startHM=String(st2.getHours()).padStart(2,'0')+':'+String(st2.getMinutes()).padStart(2,'0');key=String(st2.getHours()).padStart(2,'0')+String(st2.getMinutes()).padStart(2,'0');startDay=st2.getFullYear()+'-'+String(st2.getMonth()+1).padStart(2,'0')+'-'+String(st2.getDate()).padStart(2,'0');}catch(e){}
        var info={},dist=0,cal=0,hr=0;
        function walk(o,depth,prefix){
          if(o==null||depth>3||typeof o!=='object')return;
          for(var k in o){
            if(!o.hasOwnProperty(k))continue;
            if(k==='interval'||k==='metadata'||k==='events'||k==='splits'||k==='laps')continue;
            var v=o[k];if(v==null)continue;
            if(typeof v==='number'||typeof v==='string'){
              var num=typeof v==='number'?v:parseFloat(v);var kl=k.toLowerCase();
              if(!isNaN(num)&&num>0){
                if(kl.indexOf('calorie')>=0||kl==='kcal'||kl.indexOf('energy')>=0){if(!cal)cal=Math.round(num);}
                else if(kl.indexOf('distance')>=0){if(!dist)dist=num>500?Math.round(num/100)/10:Math.round(num*100)/100;}
                else if(kl.indexOf('heartrate')>=0||kl.indexOf('heart_rate')>=0||kl==='bpm'){if(!hr&&num>30&&num<230)hr=Math.round(num);}
              }
              if(Object.keys(info).length<14&&kl.indexOf('time')<0&&kl!=='id'&&kl!=='datasource'&&String(v).length<40){info[(prefix?prefix+' ':'')+ghPretty(k)]=typeof v==='number'?(Math.round(v*10)/10):String(v);}
            } else if(typeof v==='object'&&!Array.isArray(v)){walk(v,depth+1,ghPretty(k));}
          }
        }
        walk(ex,0,'');
        if(!startDay||startDay===dateKey)list.push({name:String(name),dur:dur,dist:dist,cal:cal,hr:hr,start:startHM,startDay:startDay||dateKey,info:info,key:key});
      });
      cb(list,'');
    }catch(e){cb(null,'parse');}
  });
}
function ghHeartSeries(dateKey,at,cb){
  var R=ghDayRangeZ(dateKey);
  var filters=[
    'heart_rate.sample_time.physical_time >= "'+R[0]+'"',
    'heart_rate.sample_time.physical_time >= "'+R[0]+'" AND heart_rate.sample_time.physical_time <= "'+R[1]+'"',
    ''
  ];
  (function tryF(fi){
    if(fi>=filters.length)return cb(null,'all HR filters rejected');
    var f=encodeURIComponent(filters[fi]);
    var url='/users/me/dataTypes/heart-rate/dataPoints?'+(filters[fi]?('filter='+f+'&'):'')+'pageSize=1000';
    ghReqE('GET',url,at,null,function(ok,d,stt,err){
    if(!ok){if(stt===400)return tryF(fi+1);return cb(null,stt+' '+err);}
    try{
      var hourly=[];for(var i=0;i<24;i++)hourly.push({sum:0,n:0,min:999,max:0});
      var all=[],mn=999,mx=0;
      (d.dataPoints||[]).forEach(function(dp){
        var hrObj=dp.heartRate||dp;
        var ts=hrObj.sampleTime||dp.sampleTime||hrObj.endTime||dp.endTime||null;
        var c=Object.assign({},hrObj);delete c.sampleTime;delete c.endTime;
        var bpm=ghNum(c,0);if(!(bpm>20&&bpm<240))return;
        var when=null;try{when=new Date((ts&&(ts.physicalTime||ts.endTime))||ts);}catch(e){}
        if(when&&!isNaN(when)){var wk=when.getFullYear()+'-'+String(when.getMonth()+1).padStart(2,'0')+'-'+String(when.getDate()).padStart(2,'0');if(wk!==dateKey)return;}
        var hr=(when&&!isNaN(when))?when.getHours():0;
        if(hr>=0&&hr<24){hourly[hr].sum+=bpm;hourly[hr].n++;if(bpm<hourly[hr].min)hourly[hr].min=bpm;if(bpm>hourly[hr].max)hourly[hr].max=bpm;}
        all.push(bpm);if(bpm<mn)mn=bpm;if(bpm>mx)mx=bpm;
      });
      if(!all.length)return tryF(fi+1);
      var avg=Math.round(all.reduce(function(a,b){return a+b;},0)/all.length);
      var series=hourly.map(function(h){return h.n?{avg:Math.round(h.sum/h.n),min:h.min,max:h.max}:null;});
      if(!all.length)return tryF(fi+1);
      cb({avg:avg,min:mn,max:mx,series:series,count:all.length},'');
    }catch(e){cb(null,'parse');}
    });
  })(0);
}
function ghHourlySteps(dateKey,at,cb){
  try{
    var p=dateKey.split('-');
    var d0=new Date(+p[0],+p[1]-1,+p[2],0,0,0),d1=new Date(+p[0],+p[1]-1,+p[2],23,59,59);
    ghReq('POST','/users/me/dataTypes/steps/dataPoints:rollUp',at,{range:{startTime:d0.toISOString(),endTime:d1.toISOString()},windowSize:'3600s'},function(d){
      try{
        var arr=[];for(var i=0;i<24;i++)arr.push(0);
        (d.rollupDataPoints||[]).forEach(function(rp){
          var t=new Date(rp.startTime);var hr=t.getHours();
          var v=0;try{v=parseInt(rp.steps.countSum)||0;}catch(e){v=ghNum(rp.steps,0);}
          if(hr>=0&&hr<24)arr[hr]+=v;
        });
        cb(arr.some(function(x){return x>0;})?arr:null);
      }catch(e){cb(null);}
    });
  }catch(e){cb(null);}
}
function fbExportCode(){var t=fbGet();if(!t)return null;try{return 'AQGH1.'+btoa(JSON.stringify(t));}catch(e){return null;}}
function fbImportCode(s){try{s=(s||'').trim();if(s.indexOf('AQGH1.')===0)s=s.slice(6);var o=JSON.parse(atob(s));if(o&&o.cid&&o.csec&&(o.rt||o.at)){fbSet(o);return true;}}catch(e){}return false;}
function fbIsStandalone(){try{return window.navigator.standalone===true||window.matchMedia('(display-mode: standalone)').matches;}catch(e){return false;}}
function fbFetchDay(dateKey,cb,full){
  fbEnsureToken(function(at){
    if(!at)return cb(null);
    var out={diag:{}},pend=full?13:11,any=false;
    function done(ok){if(ok)any=true;if(--pend===0)cb(any?out:null);}
    ghDailySum('steps',dateKey,at,function(v){out.diag.steps=v>0?'ok':'empty';if(v>0){out.steps=Math.round(v);}done(v>0);});
    ghSleepDay(dateKey,at,function(s){out.diag.sleep=s?'ok':'empty';if(s&&s.hrs>0){out.sleepHrs=s.hrs;out.sleepStart=s.start;out.sleepEnd=s.end;out.sleepStages=s.stages;out.sleepSeq=s.seq;}done(!!s);});
    ghMetric('rhr',dateKey,at,function(v,note){out.diag.rhr=v>0?('ok ('+note+')'):note;if(v>0)out.rhr=v;done(v>0);});
    ghMetric('calOut',dateKey,at,function(v,note){if(v>0){out.diag.calOut='ok ('+note+')';out.calOut=v;done(true);}else ghMetric('calOut2',dateKey,at,function(v2,note2){out.diag.calOut=v2>0?('ok active ('+note2+')'):(note+' || '+note2);if(v2>0)out.calOut=v2;done(v2>0);});});
    ghMetric('calIn',dateKey,at,function(v,note){out.diag.calIn=v>0?('ok ('+note+')'):note;if(v>0)out.calIn=v;done(v>0);});
    ghMetric('azm',dateKey,at,function(v,note){if(v>300)v=Math.round(v/60);out.diag.azm=v>0?('ok ('+note+')'):note;if(v>0)out.azm=v;done(v>0);});
    ghMetric('hrv',dateKey,at,function(v,note){out.diag.hrv=v>0?('ok ('+note+')'):note;if(v>0)out.hrv=v;done(v>0);});
    ghMetric('resp',dateKey,at,function(v,note){out.diag.resp=v>0?('ok ('+note+')'):note;if(v>0)out.resp=v;done(v>0);});
    ghMetric('spo2',dateKey,at,function(v,note){out.diag.spo2=v>0?('ok ('+note+')'):note;if(v>0)out.spo2=v;done(v>0);});
    ghMetric('vo2max',dateKey,at,function(v,note){out.diag.vo2max=v>0?('ok ('+note+')'):note;if(v>0)out.vo2max=v;done(v>0);});
    ghExercisesDay(dateKey,at,function(list,note){out.diag.exercise=(list&&list.length)?('ok ('+list.length+')'):(note||'no sessions');if(list&&list.length)out.exercises=list;done(!!(list&&list.length));});
    if(full){ghHourlySteps(dateKey,at,function(arr){if(arr)out.stepsHr=arr;done(!!arr);});
      ghHeartSeries(dateKey,at,function(hs,note){out.diag.hr=hs?('ok ('+hs.count+' pts)'):note;if(hs){out.hrSeries=hs.series;out.hrAvg=hs.avg;out.hrMin=hs.min;out.hrMax=hs.max;}done(!!hs);});
    }
  });
}


export {
  FB_KEY,
  fbGet,
  fbSet,
  fbRedirectUri,
  fbConnect,
  fbHandleRedirect,
  fbEnsureToken,
  fbFetchDay,
  fbExportCode,
  fbImportCode,
  fbIsStandalone,
  ghCatalog,
  ghTypesCached,
};
