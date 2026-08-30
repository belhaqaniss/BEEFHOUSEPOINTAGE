import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QrAttendanceCard({api}:{api:(data:object)=>Promise<any>}){
  const[image,setImage]=useState(""),[error,setError]=useState(""),[seconds,setSeconds]=useState(10);
  useEffect(()=>{
    let active=true,refreshTimer=0,countdownTimer=0;
    const refresh=async()=>{try{const result=await api({action:"createAttendanceQr"}),url=new URL(window.location.origin);url.searchParams.set("employee","1");url.searchParams.set("scan",result.qrToken);const dataUrl=await QRCode.toDataURL(url.toString(),{width:320,margin:1,errorCorrectionLevel:"M",color:{dark:"#171717",light:"#ffffff"}});if(active){setImage(dataUrl);setError("");setSeconds(10)}}catch(reason){if(active)setError(reason instanceof Error?reason.message:"QR code indisponible")}};
    void refresh();refreshTimer=window.setInterval(()=>void refresh(),10_000);countdownTimer=window.setInterval(()=>setSeconds(value=>value<=1?10:value-1),1_000);
    return()=>{active=false;window.clearInterval(refreshTimer);window.clearInterval(countdownTimer)};
  },[api]);
  return <section className="card attendance-qr-card"><div><small>POINTAGE MOBILE</small><h2>Scannez pour pointer</h2><p>Connectez-vous sur votre téléphone, signez, puis validez. Le code change automatiquement toutes les 10 secondes.</p><div className="qr-security"><span>✓ QR sécurisé</span><span>✓ Signature obligatoire</span><span>✓ Usage temporaire</span></div></div><div className="qr-visual">{image?<img src={image} alt="QR code de pointage employé"/>:<div className="qr-placeholder">Chargement…</div>}<strong>Nouveau code dans {seconds}s</strong>{error&&<small>{error}</small>}</div></section>;
}
