/**
 * OneBillionth analytical enquiries — server-side Vercel Function.
 * Never expose RESEND_API_KEY in browser code, HTML, or Git.
 * A verified sending subdomain is recommended to keep Zoho MX records intact.
 */
import { randomBytes } from 'node:crypto';

const TO_EMAIL = 'admin@onebillionthtech.co.za';
const MAX_REQUEST_BYTES = 4_200_000; // Vercel 4.5 MB incoming request limit
const MAX_ATTACHMENT_BYTES = 3_000_000; // Leave headroom for form fields/multipart
const EXTENSIONS = new Set(['pdf','doc','docx','xls','xlsx','jpg','jpeg','png']);
const MAX_LENGTHS = {
  full_name: 120, organisation: 150, email: 150, telephone: 50,
  service: 180, technique: 120, sample_type: 240, samples: 50,
  hazards: 80, hazard_notes: 1200, objective: 3500, date: 30
};
const REQUIRED = ['full_name','organisation','email','service','sample_type','samples','hazards','objective'];
const SERVICES = new Set([
  'Materials & Structural Characterisation', 'Spectroscopic & Optical Analysis',
  'Surface Area, Porosity & Thermal Analysis', 'Electrochemical & Energy Materials Testing',
  'Chemical, Gas & Reaction Product Analysis', 'Water & Environmental Testing',
  'Materials Preparation & Experimental Support', 'Other', 'Not sure'
]);
const QUANTITIES = new Set(['1–5 samples','6–20 samples','More than 20 samples']);
const HAZARDS = new Set(['No known hazards','Known hazards — see notes','Not sure']);

function respond(payload, code = 200) {
  return Response.json(payload,{status:code,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
function clean(value, max) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r/g,'').trim().slice(0, max);
}
function validEmail(address) {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address);
}
function plainText(data, reference, attachmentName) {
  const fields = [
    ['Reference',reference],['Full name',data.full_name],['Organisation / institution',data.organisation],
    ['Email',data.email],['Telephone',data.telephone],['Required service',data.service],
    ['Technique',data.technique],['Sample type / composition',data.sample_type],
    ['Number of samples',data.samples],['Known hazards',data.hazards],
    ['Hazard / handling requirements',data.hazard_notes],
    ['Testing objective / desired output',data.objective],['Preferred date',data.date],
    ['Attached file',attachmentName||'None']
  ];
  return 'OneBillionth Technology — Analytical & Laboratory Services\nNew website quotation enquiry\n\n' +
    fields.map(([label,value])=>`${label}: ${value||'Not specified'}`).join('\n') +
    '\n\nConsent: Visitor confirmed use of their details and attachment to respond to the enquiry.\n' +
    'Please review sample suitability, method availability, and quotation scope before confirming any service.';
}
function allowedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return true; // Some clients omit Origin
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === 'onebillionthtech.co.za' || hostname === 'www.onebillionthtech.co.za' || hostname === 'onebillionth-technology.vercel.app' ||
      (/^[\w-]+\.vercel\.app$/.test(hostname) && hostname.includes('onebillionth-technology')) ||
      (process.env.NODE_ENV !== 'production' && ['localhost','127.0.0.1'].includes(hostname));
  } catch { return false; }
}

async function handleSubmission(request) {
  if(request.method !== 'POST') return respond({ok:false,message:'Use POST to submit an enquiry.'},405);
  if(!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
    return respond({ok:false,message:'Online submissions are not yet configured. Please email admin@onebillionthtech.co.za directly.'},503);
  }
  if(!allowedOrigin(request)) return respond({ok:false,message:'Invalid submission origin.'},403);
  const contentType = request.headers.get('content-type')||'';
  if(!contentType.startsWith('multipart/form-data')) return respond({ok:false,message:'Invalid form encoding.'},415);
  const size=Number(request.headers.get('content-length')||0);
  if(size > MAX_REQUEST_BYTES) return respond({ok:false,message:'The total request is too large. Please reduce the attachment size.'},413);
  let input;
  try { input = await request.formData(); } catch { return respond({ok:false,message:'Unable to read the submission. Please retry.'},400); }
  if(input.get('website')) return respond({ok:false,message:'Unable to accept this enquiry.'},400); // bot honeypot
  const data={};
  for (const [key,max] of Object.entries(MAX_LENGTHS)) {
    const raw = input.get(key);
    if(typeof raw !== 'string' || raw.length > max) {
      return respond({ok:false,message:'Please review the form fields and try again.'},400);
    }
    data[key]=clean(raw,max);
  }
  if (REQUIRED.some(key=>!data[key]) || !validEmail(data.email) || input.get('consent') !== 'on') {
    return respond({ok:false,message:'Please complete all required fields and privacy consent.'},400);
  }
  if(!SERVICES.has(data.service) || !QUANTITIES.has(data.samples) || !HAZARDS.has(data.hazards)) {
    return respond({ok:false,message:'Invalid service or sample information.'},400);
  }
  if(data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return respond({ok:false,message:'Invalid preferred date.'},400);
  const file=input.get('supporting_file');
  const attachments=[];
  let attachmentName='';
  if(file && typeof file !== 'string' && file.size) {
    const filename=String(file.name||'').split(/[\\/]/).pop().replace(/[\u0000-\u001f]/g,'').slice(0,128);
    const ext=filename.split('.').pop().toLowerCase();
    if(!EXTENSIONS.has(ext) || file.size > MAX_ATTACHMENT_BYTES || !filename || file.size===0) {
      return respond({ok:false,message:'Attach a PDF, Word document, spreadsheet, JPG or PNG under 3 MB.'},400);
    }
    // Basic content-signature check to reject obvious spoofed executable files. This is NOT malware scanning.
    const buffer=Buffer.from(await file.arrayBuffer());
    const starts=(signature)=>buffer.subarray(0,signature.length).equals(Buffer.from(signature));
    const isPdf=starts([0x25,0x50,0x44,0x46]);
    const isZip=starts([0x50,0x4b,0x03,0x04]);
    const isOle=starts([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]);
    const isJpeg=starts([0xff,0xd8,0xff]);
    const isPng=starts([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
    const match = ext==='pdf' ? isPdf : ['docx','xlsx'].includes(ext) ? isZip : ['doc','xls'].includes(ext) ? isOle : ['jpg','jpeg'].includes(ext) ? isJpeg : isPng;
    if(!match) return respond({ok:false,message:'The attachment format does not match its file extension.'},400);
    attachmentName=filename;
    attachments.push({filename, content:buffer.toString('base64')});
  }
  const d=new Date();
  const ref=`OBT-AS-${d.toISOString().slice(0,10).replaceAll('-','')}-${randomBytes(4).toString('hex').toUpperCase()}`;
  const message={
    from:process.env.RESEND_FROM_EMAIL,
    to:[TO_EMAIL],
    reply_to:data.email,
    subject:`${ref} | Analytical quotation: ${data.service}`,
    text:plainText(data,ref,attachmentName)
  };
  if(attachments.length) message.attachments=attachments;
  try {
    const response=await fetch('https://api.resend.com/emails', {
      method:'POST',
      headers:{'Authorization':`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify(message),
      signal:AbortSignal.timeout(18000)
    });
    if(!response.ok) {
      console.error('Resend rejected enquiry',ref,'status',response.status);
      return respond({ok:false,message:'The email provider could not accept your enquiry. Please try again or contact admin@onebillionthtech.co.za.'},502);
    }
    const result=await response.json();
    if(!result?.id) return respond({ok:false,message:'Unable to confirm submission acceptance. Please contact OneBillionth Technology.'},502);
    return respond({ok:true,reference:ref,message:'Your enquiry and any attachment were accepted for email delivery to OneBillionth Technology.'},200);
  } catch(err) {
    console.error('Analytical enquiry provider connection error',ref,String(err?.message||'unknown'));
    return respond({ok:false,message:'Unable to connect to the email provider. Please try again shortly.'},502);
  }
}

export default {fetch:handleSubmission};
