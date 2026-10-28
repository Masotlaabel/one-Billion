const header = document.querySelector('.site-header');
const progress = document.getElementById('pageProgress');
const backTop = document.getElementById('backTop');
const menuButton = document.getElementById('menuButton');
const mobileMenu = document.getElementById('mobileMenu');
const navLinks = [...document.querySelectorAll('.desktop-nav a')];

function onScroll(){
  const y = window.scrollY;
  if(header) header.classList.toggle('scrolled', y > 20);
  if(backTop) backTop.classList.toggle('show', y > 700);
  if(progress){
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = `${max ? (y/max)*100 : 0}%`;
  }
}
addEventListener('scroll', onScroll, {passive:true}); onScroll();
if(backTop) backTop.addEventListener('click',()=>scrollTo({top:0,behavior:'smooth'}));

if(menuButton && mobileMenu){
  menuButton.addEventListener('click',()=>{
    const open = mobileMenu.classList.toggle('open');
    menuButton.classList.toggle('open', open);
    menuButton.setAttribute('aria-expanded', open);
    mobileMenu.setAttribute('aria-hidden', !open);
  });
  mobileMenu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{
    mobileMenu.classList.remove('open'); menuButton.classList.remove('open');
    menuButton.setAttribute('aria-expanded','false'); mobileMenu.setAttribute('aria-hidden','true');
  }));
}

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(entry.isIntersecting){
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
    }
  });
},{threshold:.09});
document.querySelectorAll('.reveal').forEach((el,i)=>{
  el.style.transitionDelay = `${Math.min((i%4)*45,135)}ms`;
  revealObserver.observe(el);
});

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if(!entry.isIntersecting) return;
    const id = entry.target.id;
    navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${id}`));
  });
},{rootMargin:'-35% 0px -55% 0px',threshold:0});
document.querySelectorAll('#home,#about,#services,#team,#contact').forEach(section=>sectionObserver.observe(section));

const contactForm=document.querySelector('[data-review-form]');
if(contactForm){
  contactForm.addEventListener('submit',e=>{
    e.preventDefault();
    const note=contactForm.querySelector('.form-note');
    if(note) note.textContent='Thank you — this review form is ready for email/backend integration before final launch.';
  });
}

// Final team-review update: looping R&D image slideshow.
document.querySelectorAll('[data-slideshow]').forEach(slideshow => {
  const slides = [...slideshow.querySelectorAll('.rd-slide')];
  const dotsWrap = slideshow.querySelector('.rd-slide-dots');
  const prev = slideshow.querySelector('.rd-slide-prev');
  const next = slideshow.querySelector('.rd-slide-next');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (slides.length < 2) return;

  let current = 0;
  let timer = null;

  const dots = slides.map((_, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'rd-slide-dot';
    dot.setAttribute('aria-label', `Show slideshow image ${index + 1}`);
    dot.addEventListener('click', () => {
      show(index);
      restart();
    });
    dotsWrap?.appendChild(dot);
    return dot;
  });

  function show(index){
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => slide.classList.toggle('active', i === current));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === current));
  }

  function stop(){
    if(timer){
      clearInterval(timer);
      timer = null;
    }
  }

  function start(){
    if(reduceMotion || timer) return;
    timer = setInterval(() => show(current + 1), 4500);
  }

  function restart(){
    stop();
    start();
  }

  prev?.addEventListener('click', () => { show(current - 1); restart(); });
  next?.addEventListener('click', () => { show(current + 1); restart(); });
  slideshow.addEventListener('mouseenter', stop);
  slideshow.addEventListener('mouseleave', start);
  slideshow.addEventListener('focusin', stop);
  slideshow.addEventListener('focusout', start);
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());

  show(0);
  start();
});
