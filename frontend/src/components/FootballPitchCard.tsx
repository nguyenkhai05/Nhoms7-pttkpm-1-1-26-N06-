import type {Pitch} from '../types';

export default function FootballPitchCard({pitch,onOpen}:{pitch:Pitch;onOpen:(id:number)=>void}){return <article>{pitch.image?<img src={pitch.image} alt={pitch.name}/>:<div className="pitch-art">⚽ SÂN {pitch.type}</div>}<h2>{pitch.name}</h2><p>{pitch.complexName} · {pitch.district}</p><p>{pitch.amenities.map(x=>x.name).join(' · ')}</p><b>Từ {pitch.startingPrice.toLocaleString('vi-VN')} đ/ca</b><p><button onClick={()=>onOpen(pitch.id)}>Chi tiết và lịch trống</button></p></article>;}
