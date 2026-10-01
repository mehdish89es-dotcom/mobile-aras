const express=require('express');
const path=require('path');
const cheerio=require('cheerio');
const fetch=(...args)=>import('node-fetch').then(({default:f})=>f(...args));
const app=express(); const PORT=process.env.PORT||3000;
app.use(express.static(__dirname));
const sources={
 Samsung:'https://www.mobile.ir/phones/prices.aspx?brandid=0&duration=1&pagesize=200&sort=date&terms=samsung',
 Xiaomi:'https://www.mobile.ir/phones/prices.aspx?brandid=0&duration=1&pagesize=200&sort=date&terms=xiaomi',
 Apple:'https://www.mobile.ir/phones/prices.aspx?brandid=0&duration=1&pagesize=200&sort=date&terms=iphone'
};
const cache={data:[],updatedAt:null};
function faNum(s){return Number(String(s||'').replace(/[٬,،\s]/g,'' ).replace(/[^0-9]/g,''))||0}
function parsePage(html,brand){
 const $=cheerio.load(html); const out=[];
 $('table tr').each((_,tr)=>{
   const t=$(tr).text(' ').replace(/\s+/g,' ').trim();
   if(!t) return;
   const a=$(tr).find('a').first(); const name=a.text().trim();
   const priceMatch=t.match(/([0-9][0-9,٬،]*)\s*(?:تومان|ریال)?/);
   if(!name || !priceMatch) return;
   if(!/(Samsung|Galaxy|Xiaomi|Redmi|Poco|iPhone|Apple)/i.test(name)) return;
   const price=faNum(priceMatch[1]); if(price<100000) return;
   const img=$(tr).find('img').first().attr('src')||'';
  out.push({name,brand,price,image:img.startsWith('//')?'https:'+img:img,source:'mobile.ir',rawDate:t.includes('امروز')?'امروز':((t.match(/\d+\s*(روز|هفته) پیش/)||[])[0]||'ثبت‌شده در منبع')});
 });
 const map=new Map(); for(const x of out) if(!map.has(x.name)) map.set(x.name,x); return [...map.values()];
}
async function update(){
 const all=[];
 for(const [brand,url] of Object.entries(sources)){
  try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 MobileAras/1.0'}}); if(!r.ok) throw new Error('HTTP '+r.status); const html=await r.text(); all.push(...parsePage(html,brand));}
  catch(e){console.error(brand,e.message)}
 }
 if(all.length){cache.data=all; cache.updatedAt=new Date().toISOString();}
 return cache;
}
app.get('/api/prices',async(req,res)=>{try{if(req.query.refresh==='1' || !cache.updatedAt || Date.now()-new Date(cache.updatedAt).getTime()>5*60*1000) await update(); res.json({ok:true,live:cache.data.length>0,updatedAt:cache.updatedAt,source:'mobile.ir',items:cache.data});}catch(e){res.status(502).json({ok:false,error:e.message,items:cache.data});}});
app.get('/api/health',(req,res)=>res.json({ok:true,updatedAt:cache.updatedAt,count:cache.data.length}));
update(); setInterval(update,5*60*1000);
app.listen(PORT,()=>console.log('Mobile Aras live server: http://localhost:'+PORT));
