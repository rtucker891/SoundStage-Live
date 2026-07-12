"use client";
import Link from "next/link";
import { useState } from "react";
const plans = [
  { name:"Free", monthly:0, annual:0, line:"Start your first show", features:["1 show","Record or upload audio","Public show page","RSS import"] },
  { name:"Creator", monthly:19, annual:190, line:"Publish consistently", popular:true, features:["Unlimited episodes","AI production toolkit","Podcast-ready RSS feed","Creator analytics"] },
  { name:"Studio", monthly:49, annual:490, line:"Create with your team", features:["Everything in Creator","Multiple shows","Team roles and workflow","Priority support"] },
];
export default function PricingSection({standalone=false}:{standalone?:boolean}){
  const [annual,setAnnual]=useState(false);
  return <section id="pricing" className={`marketing-section bg-[#f7f4ee] text-[#171717] ${standalone?"min-h-[calc(100vh-150px)] pt-16":""}`}><div className="mx-auto max-w-7xl">
    <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end"><div><p className="section-eyebrow text-[#7158e8]">Simple pricing</p><h2 className="section-title mt-5">Start free.<br/><em>Grow your way.</em></h2></div><div className="pricing-toggle" aria-label="Billing period"><button onClick={()=>setAnnual(false)} className={!annual?"active":""}>Monthly</button><button onClick={()=>setAnnual(true)} className={annual?"active":""}>Annual <span>Save 17%</span></button></div></div>
    <div className="mt-14 grid gap-5 lg:grid-cols-3">{plans.map(plan=><article key={plan.name} className={`pricing-card ${plan.popular?"pricing-card-popular":""}`}>{plan.popular&&<div className="popular-label">Most popular</div>}<p className="text-sm font-bold uppercase tracking-[.16em]">{plan.name}</p><p className="mt-3 text-black/55">{plan.line}</p><div className="mt-9 flex items-end gap-2"><span className="text-6xl font-semibold tracking-[-.06em]">${annual?plan.annual:plan.monthly}</span><span className="mb-2 text-black/45">/{annual?"year":"month"}</span></div><Link href="/dashboard" className={`marketing-button mt-8 w-full justify-center ${plan.popular?"marketing-button-purple":"marketing-button-dark"}`}>Preview {plan.name} <span>→</span></Link><ul className="mt-8 space-y-4 border-t border-black/10 pt-7">{plan.features.map(feature=><li key={feature} className="flex gap-3 text-sm"><span className="text-[#7158e8]">✓</span>{feature}</li>)}</ul></article>)}</div>
    <p className="mt-7 text-center text-sm text-black/42">Development preview: authentication and payments are temporarily disabled.</p>
  </div></section>;
}
