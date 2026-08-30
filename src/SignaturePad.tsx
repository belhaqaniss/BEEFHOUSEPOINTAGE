import { useRef } from "react";

export default function SignaturePad({setValue}:{setValue:(value:string)=>void}){
  const canvasRef=useRef<HTMLCanvasElement>(null),drawing=useRef(false);
  const position=(event:React.PointerEvent<HTMLCanvasElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    return {x:(event.clientX-rect.left)*(event.currentTarget.width/rect.width),y:(event.clientY-rect.top)*(event.currentTarget.height/rect.height)};
  };
  const start=(event:React.PointerEvent<HTMLCanvasElement>)=>{drawing.current=true;event.currentTarget.setPointerCapture(event.pointerId);const context=event.currentTarget.getContext("2d"),point=position(event);if(context){context.beginPath();context.moveTo(point.x,point.y);context.strokeStyle="#172139";context.lineWidth=2.5;context.lineCap="round"}};
  const move=(event:React.PointerEvent<HTMLCanvasElement>)=>{if(!drawing.current)return;const context=event.currentTarget.getContext("2d"),point=position(event);if(context){context.lineTo(point.x,point.y);context.stroke()}};
  const end=()=>{drawing.current=false;if(canvasRef.current)setValue(canvasRef.current.toDataURL("image/png"))};
  const clear=()=>{const canvas=canvasRef.current;if(canvas){canvas.getContext("2d")?.clearRect(0,0,canvas.width,canvas.height);setValue("")}};
  return <div className="signature"><canvas ref={canvasRef} width="860" height="270" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}/><em>Signez avec votre doigt ou votre souris</em><button type="button" onClick={clear}>Effacer</button></div>;
}
