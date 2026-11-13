import { useCallback, useEffect, useState } from "react";
import PageHead from "../components/PageHead";

type Refund = { id:number; paymentId?:number; amount:number; reason:string; status:string; requesterName?:string; approverName?:string; bookingCode?:string };
type Payment = { id:number; bookingId:number|null; bookingCode?:string; purpose:string; method:"CASH"|"BANK_QR"; amount:number; status:string; paidAt:string|null; createdAt:string; refunds?:Refund[] };
const money=(n:number)=>new Intl.NumberFormat("vi-VN",{style:"currency",currency:"VND",maximumFractionDigits:0}).format(n);
const apiBase="/api/payments";
async function call<T>(path:string,init?:RequestInit):Promise<T>{
  const token=localStorage.getItem("accessToken");
  const response=await fetch(apiBase+path,{...init,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{}) ,...init?.headers}});
  const body=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(typeof body?.message==="string"?body.message:Array.isArray(body?.message)?body.message.join(", "):"Không thể thực hiện yêu cầu.");
  return body?.data as T;
}
export default function TransactionsPage(){
  const [rows,setRows]=useState<Payment[]>([]);
  const [pendingRefunds,setPendingRefunds]=useState<Refund[]>([]);
  const [selected,setSelected]=useState<Payment|null>(null);
  const [status,setStatus]=useState("");
  const [method,setMethod]=useState("");
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [canWrite]=useState(()=>JSON.parse(localStorage.getItem("user")||"{}")?.permissions?.includes("PAYMENT_WRITE")??false);
  const [canApprove]=useState(()=>JSON.parse(localStorage.getItem("user")||"{}")?.permissions?.includes("REFUND_APPROVE")??false);
  const load=useCallback(async()=>{
    setBusy(true);setError("");
    try{
      const q=new URLSearchParams(Object.entries({status,method,from,to}).filter(([,v])=>v));
      const data=await call<Payment[]>("?"+q.toString());setRows(data);
      if(canApprove)setPendingRefunds(await call<Refund[]>("/refunds?status=REQUESTED"));
      if(selected){const fresh=data.find(x=>x.id===selected.id);if(fresh)setSelected(await call<Payment>(`/${fresh.id}`));}
    }catch(e){setError(e instanceof Error?e.message:"Không thể tải giao dịch.");}
    finally{setBusy(false);}
  },[status,method,from,to,canApprove]);
  useEffect(()=>{void load();},[load]);
  async function choose(id:number){try{setSelected(await call<Payment>(`/${id}`));}catch(e){setError(e instanceof Error?e.message:"Không tải được chi tiết.");}}
  async function act(path:string,body?:unknown){
    setBusy(true);setError("");
    try{await call(path,{method:(path==="/cash"||path.endsWith("/refunds"))?"POST":"PATCH",...(body?{body:JSON.stringify(body)}:{})});await load();if(selected)await choose(selected.id);}
    catch(e){setError(e instanceof Error?e.message:"Thao tác thất bại.");}
    finally{setBusy(false);}
  }
  async function requestRefund(p:Payment){
    const amount=Number(window.prompt(`Số tiền muốn hoàn (tối đa ${money(p.amount)}):`));
    if(!Number.isFinite(amount)||amount<=0)return;
    const reason=window.prompt("Lý do hoàn tiền:");if(!reason?.trim())return;
    await act(`/${p.id}/refunds`,{amount,reason});
  }
  async function cash(){
    const bookingId=Number(window.prompt("Nhập mã ID booking cần thu tiền:"));
    if(!Number.isInteger(bookingId)||bookingId<=0)return;
    const amount=Number(window.prompt("Số tiền thu tại quầy (VND):"));
    if(!Number.isFinite(amount)||amount<=0)return;
    await act("/cash",{bookingId,amount});
  }
  return <>
    <PageHead tag="QUẢN TRỊ TÀI CHÍNH" title="Giao dịch & hoàn tiền" subtitle="Theo dõi các khoản thu, yêu cầu hoàn và trạng thái xử lý."/>
    {error&&<div className="demo-banner" role="alert">{error}</div>}
    <section className="panel" style={{marginBottom:20}}>
      <div className="section-heading"><div><h2>Bộ lọc giao dịch</h2><p className="muted">Lọc theo trạng thái, phương thức và khoảng ngày tạo.</p></div>
      {canWrite&&<button className="primary" onClick={()=>void cash()}>＋ Thu tiền tại quầy</button>}</div>
      <div className="filter-grid">
        <label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả</option><option value="PENDING">Chờ xử lý</option><option value="SUCCEEDED">Thành công</option><option value="FAILED">Thất bại</option></select></label>
        <label>Hình thức<select value={method} onChange={e=>setMethod(e.target.value)}><option value="">Tất cả</option><option value="CASH">Tiền mặt</option><option value="BANK_QR">Bank QR</option></select></label>
        <label>Từ ngày<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label>
        <label>Đến ngày<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label>
        <button className="outline" onClick={()=>{setStatus("");setMethod("");setFrom("");setTo("");}}>Xóa lọc</button>
      </div>
    </section>
    {canApprove&&<section className="panel" style={{marginBottom:20}}>
      <div className="section-heading"><h2>Yêu cầu hoàn tiền chờ duyệt</h2><span className="muted">{pendingRefunds.length} yêu cầu</span></div>
      {!pendingRefunds.length?<p className="muted">Không có yêu cầu đang chờ duyệt.</p>:<div className="table-wrap"><table><thead><tr><th>Yêu cầu</th><th>Booking</th><th>Số tiền</th><th>Lý do</th><th>Người yêu cầu</th><th>Thao tác</th></tr></thead><tbody>
        {pendingRefunds.map(r=><tr key={r.id}><td>#{r.id}</td><td>{r.bookingCode||r.paymentId||"—"}</td><td>{money(r.amount)}</td><td>{r.reason}</td><td>{r.requesterName||"—"}</td><td><div className="action-row"><button className="primary" onClick={()=>void act(`/refunds/${r.id}/approve`)}>Duyệt</button><button className="outline" onClick={()=>void act(`/refunds/${r.id}/reject`)}>Từ chối</button></div></td></tr>)}
      </tbody></table></div>}
    </section>}
    <div className="two-columns">
      <section className="panel">
        <div className="section-heading"><h2>Danh sách giao dịch</h2><span className="muted">{rows.length} giao dịch</span></div>
        {busy&&<p className="muted">Đang tải…</p>}
        {!rows.length&&!busy&&<p className="muted">Chưa có giao dịch phù hợp.</p>}
        <div className="table-wrap"><table><thead><tr><th>Mã</th><th>Booking</th><th>Số tiền</th><th>Phương thức</th><th>Trạng thái</th></tr></thead>
        <tbody>{rows.map(p=><tr key={p.id} onClick={()=>void choose(p.id)} style={{cursor:"pointer",background:selected?.id===p.id?"#eef6f2":undefined}}>
          <td>#{p.id}</td><td>{p.bookingCode||`#${p.bookingId??"—"}`}</td><td>{money(p.amount)}</td><td>{p.method}</td><td><span className={`badge ${p.status==="SUCCEEDED"?"green":p.status==="FAILED"?"red":"amber"}`}>{p.status}</span></td>
        </tr>)}</tbody></table></div>
      </section>
      <section className="panel">
        <h2>Chi tiết giao dịch</h2>
        {!selected?<p className="muted">Chọn một giao dịch để xem chi tiết và xử lý hoàn tiền.</p>:<>
          <div className="order-field"><span>Mã giao dịch</span><b>#{selected.id}</b></div>
          <div className="order-field"><span>Booking</span><b>{selected.bookingCode||selected.bookingId||"—"}</b></div>
          <div className="order-field"><span>Mục đích</span><b>{selected.purpose}</b></div>
          <div className="order-field"><span>Phương thức</span><b>{selected.method}</b></div>
          <div className="order-field"><span>Số tiền</span><b>{money(selected.amount)}</b></div>
          <div className="order-field"><span>Thời gian</span><b>{selected.paidAt||selected.createdAt}</b></div>
          {selected.status==="SUCCEEDED"&&<button className="outline" onClick={()=>void requestRefund(selected)}>Yêu cầu hoàn tiền</button>}
          <h3>Yêu cầu hoàn tiền</h3>
          {!selected.refunds?.length?<p className="muted">Chưa có yêu cầu hoàn.</p>:selected.refunds.map(r=><div className="refund-item" key={r.id}>
            <div className="order-field"><span>Yêu cầu #{r.id}</span><b>{money(r.amount)}</b></div>
            <p>{r.reason}</p><p className="muted">Người yêu cầu: {r.requesterName||"—"} · Người duyệt: {r.approverName||"Chưa duyệt"}</p>
            <span className="badge amber">{r.status}</span>
            {canApprove&&r.status==="REQUESTED"&&<div className="action-row"><button className="primary" onClick={()=>void act(`/refunds/${r.id}/approve`)}>Duyệt</button><button className="outline" onClick={()=>void act(`/refunds/${r.id}/reject`)}>Từ chối</button></div>}
            {canApprove&&r.status==="APPROVED"&&<div className="action-row"><button className="primary" onClick={()=>void act(`/refunds/${r.id}/paid`,{providerReference:window.prompt("Mã tham chiếu hoàn tiền (nếu có):")||undefined})}>Xác nhận đã hoàn</button><button className="outline" onClick={()=>void act(`/refunds/${r.id}/failed`)}>Đánh dấu thất bại</button></div>}
          </div>)}
        </>}
      </section>
    </div>
  </>;
}
