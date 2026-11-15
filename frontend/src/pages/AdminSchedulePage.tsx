import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../lib/AppContext';
import PageHead from '../components/PageHead';
import DemoBanner from '../components/DemoBanner';

type Slot = { slotId:number; start:string; end:string; state:string; bookingId:number|null; bookingCode?:string; bookingStatus?:string; customerName?:string; customerPhone?:string; pitchAmount:number; serviceAmount:number; depositDue:number; paidAmount:number };
type Pitch = { id:number; name:string; type:number; status:string; complexId:number; slots:Slot[] };
async function api(path:string, init:RequestInit={}) {
  const token=localStorage.getItem('accessToken');
  const res=await fetch(path,{...init,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...init.headers}});
  const json=await res.json().catch(()=>({})); if(!res.ok) throw new Error(json.message||'Yêu cầu không thành công.'); return json.data;
}
export default function AdminSchedulePage() {
  const {date,setDate}=useApp(); const [pitches,setPitches]=useState<Pitch[]>([]); const [loading,setLoading]=useState(false); const [error,setError]=useState('');
  const load=useCallback(async()=>{try{setLoading(true);setError('');const result=await api(`/api/schedule/matrix?date=${date}`);setPitches(result.pitches||[]);}catch(e){setError(e instanceof Error?e.message:'Không tải được lịch.');}finally{setLoading(false);}},[date]);
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),5000);return()=>clearInterval(timer);},[load]);
  async function click(pitch:Pitch,slot:Slot){try{
    if(slot.state==='AVAILABLE'){
      const guestName=window.prompt('Tên khách vãng lai:');if(!guestName)return;const guestPhone=window.prompt('Số điện thoại (10–11 số, bắt đầu bằng 0):');if(!guestPhone)return;
      const stock=await api(`/api/inventory/services?complexId=${pitch.complexId}`);const serviceOptions=(stock||[]).filter((x:any)=>x.active&&x.available>0).map((x:any)=>`${x.serviceId}: ${x.name} (còn ${x.available})`).join('\n');
      const rawServices=window.prompt(`Dịch vụ kèm theo (không bắt buộc, định dạng ID:số lượng, ví dụ 1:2,2:1).\n${serviceOptions}`,'');
      const services=(rawServices||'').split(',').map(value=>{const [serviceId,quantity]=value.trim().split(':').map(Number);return {serviceId,quantity};}).filter(x=>Number.isSafeInteger(x.serviceId)&&x.serviceId>0&&Number.isSafeInteger(x.quantity)&&x.quantity>0);
      await api('/api/schedule/walk-in',{method:'POST',body:JSON.stringify({pitchId:pitch.id,slotId:slot.slotId,date,guestName,guestPhone,payMethod:'CASH',services})});window.alert('Tạo đơn tại quầy, thu đủ tiền và cập nhật kho thành công. Sân chuyển sang IN_USE.');
    } else if(slot.state==='DEPOSITED'&&slot.bookingId){
      const due=Math.max(0,slot.pitchAmount+slot.serviceAmount-slot.paidAmount);const entered=window.prompt(`Số tiền còn phải thu: ${due.toLocaleString('vi-VN')} đồng. Nhập số tiền khách thanh toán:`,String(due));if(entered===null)return;
      await api(`/api/schedule/bookings/${slot.bookingId}/check-in`,{method:'POST',body:JSON.stringify({collectAmount:Number(entered),method:'CASH'})});window.alert('Check-in thành công.');
    } else if(slot.state==='IN_USE'&&slot.bookingId){if(!window.confirm(`Hoàn thành trận đấu ${slot.bookingCode||''}?`))return;await api(`/api/schedule/bookings/${slot.bookingId}/complete`,{method:'POST'});window.alert('Đã hoàn thành trận đấu.');}
    else window.alert(`Trạng thái: ${slot.state}${slot.bookingCode?` · ${slot.bookingCode}`:''}`);
    await load();
  }catch(e){window.alert(e instanceof Error?e.message:'Có lỗi xảy ra.');}}
  const columns=[...new Set(pitches.flatMap(p=>p.slots.map(slot=>String(slot.start).slice(0,5))))].sort();
  const states=[['AVAILABLE','Trống','green'],['LOCKED','Giữ tạm','yellow'],['DEPOSITED','Đã cọc','red'],['IN_USE','Đang sử dụng','blue'],['MAINTENANCE','Bảo trì','grey']];
  return <><PageHead tag="QUẢN TRỊ · UC2.2" title="Ma trận lịch sân" subtitle="Lịch lấy từ dữ liệu đặt sân; tự làm mới mỗi 5 giây. Chọn ô trống để tạo đơn tại quầy, ô đã cọc để check-in và ô đang sử dụng để hoàn thành."/><DemoBanner>Đơn tại quầy thu 100% ngay khi tạo. Đơn online thu phần còn lại khi check-in. Các thao tác đều được ghi Audit Log.</DemoBanner>
    <section className="panel"><div className="panel-head"><h2>Lịch theo ngày</h2><label className="date-label">Ngày <input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div>
      <div className="legend">{states.map(([key,label,color])=><span key={key}><i className={`dot ${color}`}/> {label}</span>)}</div>{error&&<p role="alert" className="error-text">{error}</p>}
      {loading&&!pitches.length?<p>Đang tải lịch...</p>:<div className="table-wrap"><table className="matrix-table"><thead><tr><th>Sân</th>{columns.map(time=><th key={time}>{time}</th>)}</tr></thead><tbody>{pitches.map(p=><tr key={p.id}><td><b>{p.name}</b><small>{p.type} người</small></td>{columns.map(time=>{const s=p.slots.find(slot=>String(slot.start).slice(0,5)===time);return <td key={time}>{s?<button type="button" className="matrix-cell" onClick={()=>void click(p,s)} title={s.bookingCode||s.state}><span className={`slot-pill ${s.state==='AVAILABLE'?'green':s.state==='LOCKED'?'yellow':s.state==='IN_USE'?'blue':s.state==='MAINTENANCE'?'grey':'red'}`}>{s.state==='AVAILABLE'?'Trống':s.state==='LOCKED'?'Giữ tạm':s.state==='DEPOSITED'?'Đã cọc':s.state==='IN_USE'?'Đang đá':s.state==='MAINTENANCE'?'Bảo trì':s.state}</span>{s.bookingCode&&<small>{s.bookingCode}</small>}</button>:<span className="muted">—</span>}</td>})}</tr>)}</tbody></table></div>}
    </section></>;
}
