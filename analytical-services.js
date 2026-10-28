// Analytical directory & direct quotation form. No keys or secrets in browser code.
(() => {
  'use strict';
  const search = document.getElementById('techniqueSearch');
  const entries = [...document.querySelectorAll('[data-technique]')];
  const count = document.getElementById('techniqueCount');
  const empty = document.getElementById('techniqueEmpty');
  const clear = document.getElementById('clearTechniqueSearch');
  const reset = document.getElementById('resetTechniqueSearch');
  function filterTechniques() {
    const query = (search?.value || '').toLocaleLowerCase().trim();
    let shown = 0;
    entries.forEach(entry => {
      const show = entry.textContent.toLocaleLowerCase().includes(query);
      entry.hidden = !show;
      if (show) shown++;
    });
    if (count) count.textContent = `${shown} of ${entries.length} techniques shown`;
    if (empty) empty.hidden = shown > 0;
    if (clear) clear.hidden = !query;
  }
  function resetSearch(){if (!search) return;search.value='';filterTechniques();search.focus();}
  search?.addEventListener('input',filterTechniques);
  clear?.addEventListener('click',resetSearch);
  reset?.addEventListener('click',resetSearch);
  filterTechniques();

  const form = document.getElementById('analyticalQuoteForm');
  if(!form) return;
  const status = document.getElementById('quoteFormStatus');
  const copy = document.getElementById('copyQuoteRequest');
  const sendButton = form.querySelector('button[type="submit"]');
  const fileInput = document.getElementById('supportingFile');
  const maxFileSize=3_000_000;
  document.querySelectorAll('[data-select-service]').forEach(link=>{
    link.addEventListener('click',()=>{
      const index=Number(link.dataset.selectService)-1;
      const select=document.getElementById('analyticalServiceSelect');
      if(select && select.options[index+1]) select.selectedIndex=index+1;
    });
  });
  function showStatus(message,state='info'){
    if(status){status.textContent=message;status.dataset.state=state;}
  }
  function checkFile(){
    const file=fileInput?.files?.[0];
    if(file && file.size>maxFileSize){
      showStatus('The attachment must be smaller than 3 MB. Please select a smaller file.','error');
      fileInput.setCustomValidity('Maximum size: 3 MB');
      fileInput.reportValidity();
      return false;
    }
    fileInput?.setCustomValidity('');
    return true;
  }
  fileInput?.addEventListener('change',checkFile);
  function valid(){
    if(!form.reportValidity()){
      showStatus('Complete the required fields and privacy consent first.','error');
      return false;
    }
    return checkFile();
  }
  function enquiryText(){
    const formData=new FormData(form);
    const labels=[
      ['Full name','full_name'],['Organisation / institution','organisation'],
      ['Email','email'],['Telephone','telephone'],['Service','service'],
      ['Technique','technique'],['Sample type / composition','sample_type'],
      ['Number of samples','samples'],['Hazard status','hazards'],
      ['Handling notes','hazard_notes'],['Testing objective and expected output','objective'],
      ['Preferred date','date']
    ];
    return ['Analytical Services — quotation request','',...labels.map(([label,key])=>`${label}: ${String(formData.get(key)||'Not specified').trim()}`),
      `Attachment: ${fileInput?.files?.[0]?.name||'None'}`].join('\n');
  }
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();
    if(!valid()) return;
    if(location.protocol==='file:') {
      showStatus('You are previewing a local file. Direct email delivery requires the deployed Vercel website and its email-service configuration. No enquiry was sent.','error');
      return;
    }
    sendButton.disabled=true;
    sendButton.setAttribute('aria-busy','true');
    showStatus('Submitting your enquiry and attachment securely…','pending');
    try{
      const response=await fetch('/api/analytical-enquiry',{method:'POST',body:new FormData(form),headers:{'Accept':'application/json'}});
      const result=await response.json().catch(()=>null);
      if(!response.ok||!result?.ok){
        showStatus(result?.message||'Submission could not be completed. Please contact admin@onebillionthtech.co.za.','error');
        return;
      }
      showStatus(`Enquiry accepted for email delivery. Reference: ${result.reference}. OneBillionth Technology will review your request and respond by email.`,'success');
      form.reset();
    }catch(err){
      showStatus('Unable to submit at present. Please check your connection or email admin@onebillionthtech.co.za.','error');
    }finally{
      sendButton.disabled=false;
      sendButton.removeAttribute('aria-busy');
    }
  });
  copy?.addEventListener('click',async()=>{
    if(!valid()) return;
    try{
      await navigator.clipboard.writeText(enquiryText());
      showStatus('Enquiry details copied. If direct submission is unavailable, paste them into an email to admin@onebillionthtech.co.za and attach your document manually.','info');
    }catch{
      showStatus('Copy is unavailable in this browser. You can email admin@onebillionthtech.co.za directly.','error');
    }
  });
})();
