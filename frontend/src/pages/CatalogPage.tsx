import { useEffect, useState } from 'react';
import PageHead from '../components/PageHead';
import DemoBanner from '../components/DemoBanner';
import ComplexManager from '../features/catalog/components/ComplexManager';
import PitchManager from '../features/catalog/components/PitchManager';

type Price={dayType:string;start:string;end:string;amount:number;depositPercent:number};
async function api(path:string,method='GET',body?:unknown){const token=localStorage.getItem('accessToken');const r=await fetch(path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});const j=await r.json();if(!r.ok)throw new Error(j.message||'Yêu cầu thất bại.');return j.data;}
export default function CatalogPage(){const [complexVersion,setComplexVersion]=useState(0);const [pitchId,setPitchId]=useState('1');const [prices,setPrices]=useState<Price[]>([]);const [message,setMessage]=useState('');const [from,setFrom]=useState('');const [to,setTo]=useState('');const [reason,setReason]=useState('');const [holidays,setHolidays]=useState<any[]>([]);const [holidayDate,setHolidayDate]=useState('');const [holidayName,setHolidayName]=useState('');
  async function loadPrices(){try{const r=await api(`/api/catalog/pitches/${pitchId}/prices`);setPrices(r.length?r.map((x:any)=>({dayType:x.dayType,start:String(x.start).slice(0,5),end:String(x.end).slice(0,5),amount:Number(x.amount),depositPercent:Number(x.depositPercent)})):[{dayType:'WEEKDAY',start:'06:00',end:'17:00',amount:200000,depositPercent:30},{dayType:'WEEKDAY',start:'17:00',end:'22:00',amount:350000,depositPercent:30}]);}catch(e){setMessage(e instanceof Error?e.message:'Không tải được bảng giá.');}}
  useEffect(()=>{void loadPrices();},[pitchId]);
  async function loadHolidays(){try{const r=await api('/api/catalog/holidays');setHolidays(r||[]);}catch(e){setMessage(e instanceof Error?e.message:'Không tải được ngày lễ.');}}
  useEffect(()=>{void loadHolidays();},[]);
  async function saveHoliday(){try{await api('/api/catalog/holidays','POST',{date:holidayDate,name:holidayName});setHolidayDate('');setHolidayName('');await loadHolidays();setMessage('Đã lưu ngày lễ.');}catch(e){setMessage(e instanceof Error?e.message:'Không lưu được ngày lễ.');}}
  async function removeHoliday(date:string){try{await api('/api/catalog/holidays/delete','POST',{date});await loadHolidays();}catch(e){setMessage(e instanceof Error?e.message:'Không xóa được ngày lễ.');}}
  async function save(){try{const r=await api(`/api/catalog/pitches/${pitchId}/prices`,'PUT',{prices});setMessage(`Đã lưu ${r.saved} khung giá. ${r.warnings?.join(' ')||''}`);}catch(e){setMessage(e instanceof Error?e.message:'Không lưu được giá.');}}
  async function maintenance(){
    try {
      const preview=await api(`/api/catalog/pitches/${pitchId}/maintenance/preview`,'POST',{from,to});
      const resolutions=[];
      for(const booking of preview.filter((x:any)=>x.status!=='PENDING_DEPOSIT')){
        const action=prompt(`Đơn ${booking.code}: nhập M để chuyển sân hoặc R để yêu cầu hoàn cọc.`,'R')?.trim().toUpperCase();
        if(action==='M'){
          const targetPitchId=Number(prompt(`ID sân thay thế cho ${booking.code}:`));
          if(!Number.isSafeInteger(targetPitchId)||targetPitchId<=0)return;
          resolutions.push({bookingId:booking.id,action:'MOVE',targetPitchId});
        }else if(action==='R'){
          const refundAmount=Number(prompt(`Số tiền đề nghị hoàn cho ${booking.code}:`,'100000'));
          const bankName=prompt('Ngân hàng nhận hoàn:')?.trim();
          const accountNumber=prompt('Số tài khoản nhận hoàn:')?.trim();
          const accountName=prompt('Tên chủ tài khoản:')?.trim();
          if(!Number.isSafeInteger(refundAmount)||refundAmount<=0||!bankName||!accountNumber||!accountName)return;
          resolutions.push({bookingId:booking.id,action:'REFUND',refundAmount,bankName,accountNumber,accountName});
        }else return;
      }
      await api(`/api/catalog/pitches/${pitchId}/maintenance`,'POST',{from,to,reason,resolutions});
      setMessage(`Đã tạo lịch bảo trì. ${preview.length} booking được xử lý; khoản hoàn chờ duyệt và xác nhận chuyển tiền.`);
    }catch(e){setMessage(e instanceof Error?e.message:'Không tạo được lịch bảo trì.');}
  }
  return <><PageHead tag="QUẢN TRỊ" title="Danh mục sân & bảng giá" subtitle="Quản lý cụm sân, sân bóng, bảng giá và lịch bảo trì."/><ComplexManager onChanged={()=>setComplexVersion(v=>v+1)}/><PitchManager refreshKey={complexVersion}/><DemoBanner>Khung giá không được chồng lấn trong cùng loại ngày. Giá đã lưu trên booking không thay đổi khi bảng giá được cập nhật.</DemoBanner>
    <section className="panel"><div className="panel-head"><h2>Cấu hình bảng giá</h2><label>Sân ID <input value={pitchId} onChange={e=>setPitchId(e.target.value)} style={{width:80}}/></label></div><div className="table-wrap"><table><thead><tr><th>Loại ngày</th><th>Bắt đầu</th><th>Kết thúc</th><th>Giá/ca</th><th>% cọc</th><th></th></tr></thead><tbody>{prices.map((p,i)=><tr key={i}><td><select value={p.dayType} onChange={e=>setPrices(v=>v.map((x,j)=>j===i?{...x,dayType:e.target.value}:x))}><option value="WEEKDAY">Ngày thường</option><option value="WEEKEND">Cuối tuần</option><option value="HOLIDAY">Ngày lễ</option></select></td><td><input type="time" value={p.start} onChange={e=>setPrices(v=>v.map((x,j)=>j===i?{...x,start:e.target.value}:x))}/></td><td><input type="time" value={p.end} onChange={e=>setPrices(v=>v.map((x,j)=>j===i?{...x,end:e.target.value}:x))}/></td><td><input type="number" min="1" value={p.amount} onChange={e=>setPrices(v=>v.map((x,j)=>j===i?{...x,amount:Number(e.target.value)}:x))}/></td><td><input type="number" min="1" max="100" value={p.depositPercent} onChange={e=>setPrices(v=>v.map((x,j)=>j===i?{...x,depositPercent:Number(e.target.value)}:x))}/></td><td><button className="text-button" onClick={()=>setPrices(v=>v.filter((_,j)=>j!==i))}>Xóa</button></td></tr>)}</tbody></table></div><button className="outline" onClick={()=>setPrices(v=>[...v,{dayType:'WEEKDAY',start:'06:00',end:'07:30',amount:200000,depositPercent:30}])}>Thêm khung giá</button> <button className="primary" onClick={()=>void save()}>Lưu bảng giá</button>{message&&<p role="status">{message}</p>}</section>
    <section className="panel"><h2>Ngày lễ áp dụng bảng giá HOLIDAY</h2><div className="form-grid"><label>Ngày lễ<input type="date" value={holidayDate} onChange={e=>setHolidayDate(e.target.value)}/></label><label>Tên ngày lễ<input value={holidayName} onChange={e=>setHolidayName(e.target.value)} placeholder="Tết Nguyên Đán"/></label></div><button className="primary" onClick={()=>void saveHoliday()}>Thêm ngày lễ</button><div className="table-wrap"><table><thead><tr><th>Ngày</th><th>Tên ngày lễ</th><th></th></tr></thead><tbody>{holidays.map(h=><tr key={h.date}><td>{String(h.date).slice(0,10)}</td><td>{h.name}</td><td><button className="text-button" onClick={()=>void removeHoliday(String(h.date).slice(0,10))}>Xóa</button></td></tr>)}</tbody></table></div></section>
    <section className="panel"><h2>Lập lịch bảo trì sân</h2><p className="muted">Chọn khoảng ngày. Booking đã cọc cần được chuyển sân hoặc tạo yêu cầu hoàn, giữ chỗ đến khi khoản hoàn được xác nhận. Hãy hoàn thành đơn đã check-in trước khi bảo trì.</p><div className="form-grid"><label>Từ ngày<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Đến ngày<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><label>Lý do<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Bảo dưỡng mặt sân"/></label></div><button className="primary" onClick={()=>void maintenance()}>Kiểm tra & tạo bảo trì</button></section>
  </>;
}
