import{InternalThemeProvider as Z}from"./styledSystem-DMyQCq6k.js";import{h as V}from"./shared-Owz-yDrr.js";import{u as q}from"./useDragGesture-BvtOWfY_.js";import{r as i,e as X,j as c,u as J,b as S,F as Q}from"./index-DhmK6e2j.js";import{u as ee}from"./EnvironmentContext-Cc_n6yUB.js";import{o as f}from"./index-CyQ7teVm.js";import{i as te}from"./inert-DGEPJrot.js";import"./AppearanceContext-D6yuDZyO.js";import"./OptionsContext-DBPmlG7J.js";import"./underscore-PzdM3hke.js";import"./makeLocalizable-BjmHyH1h.js";import"./localizationKeys-L95TEc06.js";import"./makeCustomizable-BERFF8RQ.js";import"./url-BgU4Hyy1.js";const j="clerk-keyless-prompt-corner",C="1.25rem",T=20,ne=10,B=.999,re="transform 350ms cubic-bezier(0.34, 1.2, 0.64, 1)",z="translate3d(0px, 0px, 0)",x={x:0,y:0};function ie(e,n){let o="bottom-right",s=1/0;for(const[l,d]of Object.entries(n)){const b=e.x-d.x,y=e.y-d.y,w=Math.sqrt(b*b+y*y);w<s&&(s=w,o=l)}return o}function oe(e){switch(e){case"top-left":return{top:C,left:C};case"top-right":return{top:C,right:C};case"bottom-left":return{bottom:C,left:C};case"bottom-right":return{bottom:C,right:C}}}const se=["top-left","top-right","bottom-left","bottom-right"];function F(e){if(!(typeof window>"u"))try{localStorage.setItem(j,e)}catch{}}function H(e){return e/1e3*B/(1-B)}function ae(e){if(e.length<2)return x;const n=e[0],o=e[e.length-1],s=o.timestamp-n.timestamp;return s===0?x:{x:(o.position.x-n.position.x)/s*1e3,y:(o.position.y-n.position.y)/s*1e3}}function ce(){const[e,n]=i.useState("bottom-right"),[o,s]=i.useState(!1),[l,d]=i.useState(!1),[b,y]=i.useState(!1),w=i.useRef(null);i.useEffect(()=>{if(typeof window>"u"){y(!0);return}try{const t=localStorage.getItem(j);t&&se.includes(t)&&n(t)}catch{}finally{y(!0)}},[]);const u=i.useRef(null),p=i.useRef({x:0,y:0}),D=i.useRef(x),E=i.useRef(0),k=i.useRef([]),v=i.useRef(null),a=i.useCallback(t=>{u.current&&(p.current=t,u.current.style.transform=`translate3d(${t.x}px, ${t.y}px, 0)`)},[]),L=i.useCallback(()=>{var W,M;const t=u.current;if(!t)return{"top-left":x,"top-right":x,"bottom-left":x,"bottom-right":x};const r=((W=v.current)==null?void 0:W.width)??t.offsetWidth??0,m=((M=v.current)==null?void 0:M.height)??t.offsetHeight??0,A=window.innerWidth-document.documentElement.clientWidth;function $(_){const N=_.includes("right"),G=_.includes("bottom");return{x:N?window.innerWidth-A-T-r:T,y:G?window.innerHeight-T-m:T}}const U=$(e);function O(_){const N=$(_);return{x:N.x-U.x,y:N.y-U.y}}return{"top-left":O("top-left"),"top-right":O("top-right"),"bottom-left":O("bottom-left"),"bottom-right":O("bottom-right")}},[e]),I=i.useCallback(t=>{const r=u.current;if(!r)return;const m=t.translation.x-p.current.x,A=t.translation.y-p.current.y;if(Math.sqrt(m*m+A*A)<.5){F(t.corner),p.current=x,r.style.transition="",r.style.transform=z,d(!1);return}const $=U=>{U.propertyName==="transform"&&(r.removeEventListener("transitionend",$),F(t.corner),t.corner===e?(p.current=x,r.style.transition="",r.style.transform=z,d(!1)):(w.current=t.corner,n(t.corner)))};r.style.transition=re,r.addEventListener("transitionend",$),a(t.translation)},[a,e]);i.useLayoutEffect(()=>{if(w.current===e){const t=u.current;t&&(p.current=x,t.style.transition="",t.style.transform=z,d(!1),w.current=null)}},[e]);const h=q({onDragStart:()=>{const t=u.current;t&&(v.current={width:t.offsetWidth,height:t.offsetHeight},D.current=p.current,k.current=[],E.current=Date.now(),t.style.transition="none",s(!0))},onDrag:t=>{const r={x:D.current.x+t.x,y:D.current.y+t.y};a(r);const m=Date.now();m-E.current>=ne&&(k.current=[...k.current.slice(-4),{position:r,timestamp:m}],E.current=m)},onDragCancel:()=>{k.current=[],v.current=null,s(!1),u.current&&(u.current.style.transition="")},onDragEnd:()=>{const t=ae(k.current),r=L();k.current=[],v.current=null,s(!1);const m=ie({x:p.current.x+H(t.x),y:p.current.y+H(t.y)},r);d(!0),I({corner:m,translation:r[m]})}});return{corner:e,isDragging:o,cornerStyle:oe(e),containerRef:u,onPointerDown:h,preventClick:l,isInitialized:b}}const le=10*1e3;function ue(){const e=X(),n=i.useRef(0),[,o]=i.useReducer(s=>s+1,0);return i.useEffect(()=>{n.current=Date.now();const s=new AbortController;return window.addEventListener("focus",async()=>{const l=e.__internal_environment;if(!l)return;if(l.authConfig.claimedAt!==null)return s.abort();if(Date.now()<n.current+le||document.visibilityState!=="visible")return;const d=2;for(let b=0;b<d;b++){const{authConfig:{claimedAt:y}}=await l.fetch();if(n.current=Date.now(),y!==null){o();break}}},{signal:s.signal}),()=>{s.abort()}},[]),ee()}function de(e){try{return e()}catch{return"https://dashboard.clerk.com/~"}}const K="18rem",fe="220ms",pe="180ms",P="cubic-bezier(0.2, 0, 0, 1)",g=f`
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  background: none;
  border: none;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    avenir next,
    avenir,
    segoe ui,
    helvetica neue,
    helvetica,
    Cantarell,
    Ubuntu,
    roboto,
    noto,
    arial,
    sans-serif;
  font-size: 1rem;
  font-weight: 400;
  line-height: 1.5;
  text-decoration: none;
  color: inherit;
  appearance: none;
`;function R(e){return e?fe:pe}const Y=f`
  ${g};
  margin: 0.75rem 0 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 1.75rem;
  padding: 0.25rem 0.625rem;
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.12px;
  color: #fde047;
  text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.32);
  white-space: nowrap;
  user-select: none;
  cursor: pointer;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 30.5%, rgba(0, 0, 0, 0.05) 100%), #454545;
  box-shadow:
    0px 0px 0px 1px rgba(255, 255, 255, 0.04) inset,
    0px 1px 0px 0px rgba(255, 255, 255, 0.04) inset,
    0px 0px 0px 1px rgba(0, 0, 0, 0.12),
    0px 1.5px 2px 0px rgba(0, 0, 0, 0.48),
    0px 0px 4px 0px rgba(243, 107, 22, 0) inset;
  outline: none;
  &:hover {
    background: #4b4b4b;
    transition: background-color 120ms ease-in-out;

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  }
  &:focus-visible {
    outline: 2px solid #6c47ff;
    outline-offset: 2px;
  }
`,me={idle:{triggerWidth:"14.25rem",title:"Configure your application",description:S(Q,{children:[c("p",{children:"Temporary API keys are enabled so you can get started immediately."}),c("ul",{children:["Add SSO connections (eg. GitHub)","Set up B2B authentication","Enable MFA"].map(e=>c("li",{children:e},e))}),c("p",{children:"Access the dashboard to customize auth settings and explore Clerk features."})]}),cta:{kind:"link",text:"Configure your application",href:({claimUrl:e})=>e}},userCreated:{triggerWidth:"15.75rem",title:"You've created your first user!",description:c("p",{children:"Head to the dashboard to customize authentication settings, view user info, and explore more features."}),cta:{kind:"link",text:"Configure your application",href:({claimUrl:e})=>e}},claimed:{triggerWidth:"14.25rem",title:"Missing environment keys",description:c("p",{children:"You claimed this application but haven't set keys in your environment. Get them from the Clerk Dashboard."}),cta:{kind:"link",text:"Get API keys",href:({claimUrl:e})=>e}},completed:{triggerWidth:"10.5rem",title:"Your app is ready",description:({appName:e,instanceUrl:n})=>S("p",{children:["Your application"," ",c("a",{href:n,target:"_blank",rel:"noopener noreferrer",children:e})," ","has been configured. You may now customize your settings in the Clerk dashboard."]}),cta:{kind:"action",text:"Dismiss",onClick:e=>{e==null||e().then(()=>{window.location.reload()})}}}};function he(e,n,o){return n?"completed":e?"claimed":o?"userCreated":"idle"}function ge(e,n){const o=me[e],s=typeof o.description=="function"?o.description({appName:n.appName,instanceUrl:n.instanceUrl}):o.description,l=o.cta,d=l.kind==="link"?{kind:"link",text:l.text,href:typeof l.href=="function"?l.href({claimUrl:n.claimUrl,instanceUrl:n.instanceUrl}):l.href}:{kind:"action",text:l.text,onClick:()=>l.onClick(n.onDismiss)};return{state:e,triggerWidth:o.triggerWidth,title:o.title,description:s,cta:d}}function xe(e){const n=i.useId(),o=ue(),{isDragging:s,cornerStyle:l,containerRef:d,onPointerDown:b,preventClick:y,isInitialized:w}=ce(),u=!!o.authConfig.claimedAt,p=typeof e.onDismiss=="function"&&u,{isSignedIn:D}=J(),E=o.displayConfig.applicationName,k=i.useMemo(()=>{if(u)return e.copyKeysUrl;const r=new URL(e.claimUrl);return r.searchParams.append("return_url",window.location.href),r.href},[u,e.copyKeysUrl,e.claimUrl]),v=i.useMemo(()=>de(()=>{const r=V(e.copyKeysUrl);return new URL(`${r.baseDomain}/apps/${r.appId}/instances/${r.instanceId}/user-authentication/email-phone-username`).href}),[e.copyKeysUrl]),[a,L]=i.useState(!0),I=he(u,p,!!D),h=i.useMemo(()=>ge(I,{appName:E,instanceUrl:v,claimUrl:k,onDismiss:e.onDismiss}),[I,E,v,k,e.onDismiss]),t=h.cta.kind==="link"?c("a",{href:h.cta.href,target:"_blank",rel:"noopener noreferrer",css:Y,children:h.cta.text}):c("button",{type:"button",onClick:h.cta.onClick,css:Y,children:h.cta.text});return S("div",{ref:d,onPointerDown:a?void 0:b,style:{...l,opacity:w?void 0:0},"data-expanded":a,css:f`
        ${g};
        position: fixed;
        z-index: 2147483647;
        border-radius: ${a?"0.75rem":"2.5rem"};
        background-color: #1f1f1f;
        box-shadow:
          0px 0px 0px 0.5px #2f3037 inset,
          0px 1px 0px 0px rgba(255, 255, 255, 0.08) inset,
          0px 0px 0.8px 0.8px rgba(255, 255, 255, 0.2) inset,
          0px 0px 0px 0px rgba(255, 255, 255, 0.72),
          0px 16px 36px -6px rgba(0, 0, 0, 0.36),
          0px 6px 16px -2px rgba(0, 0, 0, 0.2);
        height: auto;
        isolation: isolate;
        transform: translateZ(0);
        backface-visibility: hidden;
        width: ${a?K:h.triggerWidth};
        cursor: ${s?"grabbing":a?"default":"grab"};
        touch-action: none;
        transition: ${s?"none":w?`width ${R(a)} ${P}, border-radius ${R(a)} cubic-bezier(0.2, 0, 0, 1)`:"none"};

        @media (prefers-reduced-motion: reduce) {
          transition: none;
        }
        &:has(button:focus-visible) {
          outline: 2px solid #6c47ff;
          outline-offset: 2px;
        }
        &::before {
          content: '';
          pointer-events: none;
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background-image: linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 100%);
          opacity: 0.16;
          transition: opacity ${R(a)} ${P};

          @media (prefers-reduced-motion: reduce) {
            transition: none;
          }
        }
        &[data-expanded='true']::before,
        &:hover::before {
          opacity: 0.2;
        }
      `,children:[S("button",{type:"button","aria-label":"Keyless prompt","aria-controls":n,"aria-expanded":a,onClick:()=>{y||L(r=>!r)},css:f`
          ${g};
          display: flex;
          align-items: center;
          width: 100%;
          border-radius: inherit;
          padding-inline: 0.75rem;
          gap: 0.25rem;
          height: 2.5rem;
          outline: none;
          cursor: pointer;
          user-select: none;
        `,children:[S("svg",{css:f`
            width: 1rem;
            height: 1rem;
            flex-shrink: 0;
          `,fill:"none",viewBox:"0 0 128 128",children:[c("circle",{cx:"64",cy:"64",r:"20",fill:"#fff"}),c("path",{fill:"#fff",fillOpacity:".4",d:"M99.572 10.788c1.999 1.34 2.17 4.156.468 5.858L85.424 31.262c-1.32 1.32-3.37 1.53-5.033.678A35.846 35.846 0 0 0 64 28c-19.882 0-36 16.118-36 36a35.846 35.846 0 0 0 3.94 16.391c.851 1.663.643 3.712-.678 5.033L16.646 100.04c-1.702 1.702-4.519 1.531-5.858-.468C3.974 89.399 0 77.163 0 64 0 28.654 28.654 0 64 0c13.163 0 25.399 3.974 35.572 10.788Z"}),c("path",{fill:"#fff",d:"M100.04 111.354c1.702 1.702 1.531 4.519-.468 5.858C89.399 124.026 77.164 128 64 128c-13.164 0-25.399-3.974-35.572-10.788-2-1.339-2.17-4.156-.468-5.858l14.615-14.616c1.322-1.32 3.37-1.53 5.033-.678A35.847 35.847 0 0 0 64 100a35.846 35.846 0 0 0 16.392-3.94c1.662-.852 3.712-.643 5.032.678l14.616 14.616Z"})]}),c("span",{css:f`
            ${g};
            font-size: 0.875rem;
            font-weight: 500;
            color: #d9d9d9;
            white-space: nowrap;
          `,children:h.title}),c("svg",{css:f`
            width: 1rem;
            height: 1rem;
            flex-shrink: 0;
            color: #d9d9d9;
            margin-inline-start: auto;
            opacity: ${a?.5:0};
            transition: opacity ${R(a)} ease-out;

            @media (prefers-reduced-motion: reduce) {
              transition: none;
            }
            ${a&&f`
              button:hover & {
                opacity: 1;
              }
            `}
          `,viewBox:"0 0 16 16",fill:"none","aria-hidden":"true",xmlns:"http://www.w3.org/2000/svg",children:c("path",{d:"M3.75 8H12.25",stroke:"currentColor",strokeWidth:"1.5",strokeLinecap:"round",strokeLinejoin:"round"})})]}),c("div",{id:n,...te(!a),css:f`
          ${g};
          display: grid;
          grid-template-rows: ${a?"1fr":"0fr"};
          transition: grid-template-rows ${R(a)} ${P};

          @media (prefers-reduced-motion: reduce) {
            transition: none;
          }
        `,children:c("div",{css:f`
            ${g};
            min-height: 0;
            overflow: hidden;
          `,children:S("div",{css:f`
              ${g};
              width: ${K};
              padding-inline: 0.75rem;
              padding-block-end: 0.75rem;
              opacity: ${a?1:0};
              transition: opacity ${R(a)} ${P};

              @media (prefers-reduced-motion: reduce) {
                transition: none;
              }
            `,children:[c("div",{css:f`
                ${g};
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                & ul {
                  ${g};
                  list-style: disc;
                  padding-left: 1rem;
                }
                & p,
                & li {
                  ${g};
                  color: #b4b4b4;
                  font-size: 0.8125rem;
                  font-weight: 400;
                  line-height: 1rem;
                  text-wrap: pretty;
                }
                & a {
                  color: #fde047;
                  font-weight: 500;
                  outline: none;
                  text-decoration: underline;
                  &:focus-visible {
                    outline: 2px solid #6c47ff;
                    outline-offset: 2px;
                  }
                }
              `,children:h.description}),t]})})})]})}function Oe(e){return c(Z,{children:c(xe,{...e})})}export{Oe as KeylessPrompt,he as getCurrentState,ge as getResolvedContent};
