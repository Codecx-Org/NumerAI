import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Instagram, Twitter, Linkedin, Share2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ImageWithFallback } from './figma/ImageWithFallback';

// ─────────────────────────────────────────────
// CONFIG
// Proxy server (server.js) runs on port 3001 locally.
// In production set VITE_PROXY_URL to your deployed server URL.
// ─────────────────────────────────────────────
const PROXY_URL: string = (() => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PROXY_URL)
      // @ts-ignore
      return (import.meta as any).env.VITE_PROXY_URL as string;
  } catch {}
  return 'http://localhost:3001';
})();

// ─────────────────────────────────────────────
// TEXT GENERATION — via local proxy → Pollinations
// ─────────────────────────────────────────────
const generateTextViaProxy = async (
  platform: string,
  contentType: string,
  tone: string,
  description: string,
  goalLabel: string
): Promise<string> => {
  const charLimits: Record<string, number> = { twitter: 280, instagram: 2200, linkedin: 3000 };
  const limit = charLimits[platform] || 1000;
  const prompt =
    `Write a ${tone} social media ${contentType} for ${platform} about: "${description}". ` +
    `Goal: ${goalLabel}. African small business context. ` +
    `Include relevant emojis. Keep it under ${limit} characters. Return ONLY the post text, nothing else.`;

  const res = await fetch(
    `${PROXY_URL}/api/generate-text?prompt=${encodeURIComponent(prompt)}`,
    { signal: AbortSignal.timeout(18000) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `Proxy error ${res.status}`);
  }
  const data = await res.json();
  if (!data.text) throw new Error('Empty response from proxy');
  return data.text;
};

// ─────────────────────────────────────────────
// IMAGE — Pollinations image URL (direct <img>, no CORS issue)
// ─────────────────────────────────────────────
const generatePollinationsImage = async (prompt: string): Promise<string> => {
  const imagePrompt = `${prompt}, African small business, vibrant colors, professional marketing style, high quality`;
  // Route through local proxy — avoids browser CORS restrictions on image.pollinations.ai
  return `${PROXY_URL}/api/generate-image?prompt=${encodeURIComponent(imagePrompt)}&width=512&height=512&seed=${Date.now()}`;
};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface SocialMediaGeneratorProps { onBack: () => void; }
interface GeneratedContent {
  platform: string; type: string; content: string;
  hashtags: string[]; imageUrl?: string; source?: 'ai' | 'template';
}
interface Goal { id: string; label: string; sublabel: string; gradient: string; }

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────
export function SocialMediaGenerator({ onBack }: SocialMediaGeneratorProps) {
  const [selectedGoal, setSelectedGoal]         = useState<Goal | null>(null);
  const [tone, setTone]                         = useState<string>('');
  const [description, setDescription]           = useState<string>('');
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [isGenerating, setIsGenerating]         = useState(false);
  const [showShareModal, setShowShareModal]     = useState(false);
  const [errorMsg, setErrorMsg]                 = useState<string>('');

  const goals: Goal[] = [
    { id: 'grow',    label: 'Grow My Business',        sublabel: 'Expand reach & revenue',        gradient: 'from-emerald-400 to-teal-500'  },
    { id: 'attract', label: 'Attract New Customers',   sublabel: 'Bring in fresh leads',          gradient: 'from-violet-500 to-purple-600' },
    { id: 'launch',  label: 'Launch a Product',        sublabel: 'Announce something new',        gradient: 'from-orange-400 to-pink-500'   },
    { id: 'trust',   label: 'Build Trust & Authority', sublabel: 'Position yourself as the best', gradient: 'from-amber-400 to-orange-500'  },
    { id: 'sale',    label: 'Run a Promotion',         sublabel: 'Drive urgency & conversions',   gradient: 'from-red-400 to-rose-600'      },
    { id: 'retain',  label: 'Keep Customers Coming',   sublabel: 'Loyalty & repeat business',     gradient: 'from-yellow-400 to-amber-500'  },
  ];

  const tones = [
    { value: 'professional',  label: 'Professional'  },
    { value: 'casual',        label: 'Casual'        },
    { value: 'promotional',   label: 'Promotional'   },
    { value: 'inspirational', label: 'Inspirational' },
    { value: 'humorous',      label: 'Humorous'      },
    { value: 'informative',   label: 'Informative'   },
  ];

  const generateContent = async () => {
    if (!selectedGoal || !tone || !description.trim()) return;
    const platform = tone === 'professional' || tone === 'informative' ? 'linkedin' : 'instagram';
    const contentType = selectedGoal.id === 'sale' ? 'ad' : 'post';
    setIsGenerating(true);
    setErrorMsg('');
    setGeneratedContent(null);

    const imagePromise = generatePollinationsImage(description);
    let textContent = '';
    let source: GeneratedContent['source'] = 'template';

    try {
      textContent = await generateTextViaProxy(platform, contentType, tone, description, selectedGoal.label);
      source = 'ai';
    } catch (err: any) {
      console.warn('[Generate] Text failed, using template:', err?.message);
      setErrorMsg(`AI generation failed — make sure server.js is running on port 3001. (${err?.message})`);
      textContent = getTemplateContent(platform, contentType, tone, description);
      source = 'template';
    }

    const imageUrl = await imagePromise;
    const hashtags = generateSmartHashtags(platform, tone, description, textContent);
    setGeneratedContent({ platform, type: contentType, content: textContent, hashtags, imageUrl, source });
    setIsGenerating(false);
  };

  const getTemplateContent = (plt: string, type: string, tn: string, desc: string): string => {
    const templates: Record<string, Record<string, Record<string, string>>> = {
      instagram: {
        post: {
          professional:  `📊 Elevate your business with ${desc}.\n\nAfrican entrepreneurs deserve world-class tools.\n\n✅ Reduce costs\n✅ Grow faster\n✅ Stay ahead\n\nLink in bio.`,
          casual:        `Hey business owners! 👋\n\n${desc} is changing how we run businesses here in Africa!\n\nTry it and thank us later 😄 Link in bio!`,
          promotional:   `🔥 BIG NEWS: ${desc} is here!\n\n⚡ Limited spots\n🎁 Free onboarding\n\n👆 Link in bio — don't sleep on this!`,
          inspirational: `🌟 Your business breakthrough starts with ${desc}.\n\nChoose wisely. Choose growth. 💪\n\nLink in bio.`,
          humorous:      `Plot twist: ${desc} makes running a business less painful 😂\n\nWho knew?! 🙃 Link in bio.`,
          informative:   `💡 ${desc} can boost efficiency by up to 50%.\n\nAfrican businesses are already winning.\n\nLink in bio. 📚`,
        },
        ad: {
          professional:  `📊 ${desc} — The professional choice.\n\nOptimize. Scale. Succeed. Get started — link in bio.`,
          casual:        `🔥 ${desc} just dropped!\n\nEasy to use, impossible to ignore. Link in bio!`,
          promotional:   `⚡ SPECIAL OFFER: ${desc}\n\nFirst 100 get FREE access. Claim yours — link in bio!`,
          inspirational: `🚀 ${desc} — Fuel for your biggest goals.\n\nThe future belongs to those who build it. Link in bio.`,
          humorous:      `😅 ${desc} — because business is hard enough without bad tools.\n\nWe fixed that. Link in bio!`,
          informative:   `📈 ${desc} — 50% efficiency gains. Proven results. Learn more — link in bio.`,
        },
      },
      twitter: {
        post: {
          professional:  `📊 ${desc} is changing the game for African small businesses.\n\nSmart tools = bigger growth. #SmallBusiness #AfricanTech`,
          casual:        `Okay, ${desc} is actually amazing 🔥 Why didn't anyone tell us sooner?! #EntrepreneurLife`,
          promotional:   `🚨 ${desc} — special offer for African entrepreneurs! Don't miss this. #LimitedOffer`,
          inspirational: `🌟 ${desc} — Your breakthrough is closer than you think. Keep building. #Motivation`,
          humorous:      `Breaking: ${desc} makes running a business 10x less chaotic 😂 Science. Probably. #BusinessHumor`,
          informative:   `📚 3 facts about ${desc}:\n1. Saves 35% on costs\n2. Built for Africa\n3. Actually works #BusinessFacts`,
        },
      },
      linkedin: {
        post: {
          professional:  `The Future of African Business: ${desc}\n\nBusinesses investing in the right tools today will lead tomorrow.\n\n• Reduced costs\n• Real-time insights\n• Mobile-first\n\nWhat tools are you using?\n\n#DigitalTransformation #AfricanBusiness`,
          casual:        `Quick win for fellow entrepreneurs! 💡\n\n${desc} — implemented this and the difference is real.\n\nWhat's your go-to business hack?\n\n#BusinessTips`,
          promotional:   `🎉 Announcing: ${desc}\n\nBuilt for African small businesses. Limited beta — comment below!\n\n#ProductLaunch #SmallBusiness`,
          inspirational: `African entrepreneurs are building the future. 🌍\n\n${desc} is one piece of that puzzle. Keep going.\n\n#AfricanEntrepreneur`,
          humorous:      `Real talk: ${desc} shouldn't require a PhD to use 😅\n\nWe built something different. Comment 'INTERESTED'. #SmallBusiness`,
          informative:   `Data: Businesses using ${desc} see 40% faster growth.\n\nGood tools remove friction = more time for what matters.\n\n#DataDriven #BusinessIntelligence`,
        },
      },
    };
    return templates[plt]?.[type]?.[tn] || templates[plt]?.['post']?.[tn] ||
      `${desc}\n\nBuilt for African small businesses. Built for growth.\n\n#SmallBusiness #Africa`;
  };

  const generateSmartHashtags = (plt: string, tn: string, desc: string, content: string): string[] => {
    const base = ['#SmallBusiness', '#AfricanTech', '#Entrepreneurs', '#BusinessGrowth'];
    const toneMap: Record<string, string[]> = {
      professional:  ['#DigitalTransformation', '#BusinessInnovation'],
      casual:        ['#EntrepreneurLife', '#SmallBizLife'],
      promotional:   ['#LimitedOffer', '#BusinessDeal'],
      inspirational: ['#DreamBig', '#Motivation'],
      humorous:      ['#BusinessHumor', '#StartupLife'],
      informative:   ['#BusinessEducation', '#KnowledgeSharing'],
    };
    const platformMap: Record<string, string[]> = {
      instagram: ['#AfricanInnovation', '#TechForAfrica'],
      twitter:   ['#AfricanStartups', '#Innovation'],
      linkedin:  ['#BusinessStrategy', '#Leadership'],
    };
    const contextMap: Record<string, string[]> = {
      inventory: ['#InventoryManagement'], sales: ['#SalesTracker'],
      payment: ['#MobileMoney', '#MPesa'], ai: ['#Automation'], growth: ['#Scaling'],
    };
    let contextTags: string[] = [];
    Object.entries(contextMap).forEach(([key, tags]) => {
      if (desc.toLowerCase().includes(key) || content.toLowerCase().includes(key)) contextTags.push(...tags);
    });
    return [...base, ...(toneMap[tn] || []), ...(platformMap[plt] || []), ...contextTags]
      .filter((v, i, a) => a.indexOf(v) === i).slice(0, plt === 'twitter' ? 4 : 8);
  };

  const getPlatformIcon = (v: string) => {
    const m: Record<string, React.ComponentType<{ className?: string }>> = { instagram: Instagram, twitter: Twitter, linkedin: Linkedin };
    return m[v] || Instagram;
  };

  const handleShare = async (target: string) => {
    if (!generatedContent) return;
    const text = `${generatedContent.content}\n\n${generatedContent.hashtags.join(' ')}`;
    const encoded = encodeURIComponent(text);
    if (target === 'twitter') window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank', 'noopener,noreferrer,width=600,height=500');
    else if (target === 'linkedin') window.open(`https://www.linkedin.com/shareArticle?mini=true&summary=${encoded}`, '_blank', 'noopener,noreferrer,width=600,height=500');
    else if (target === 'instagram') {
      if (navigator.share) { try { await navigator.share({ text }); } catch {} }
      else { await navigator.clipboard.writeText(text); window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer'); }
    } else if (target === 'whatsapp') window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');
    setShowShareModal(false);
  };

  const renderPlatformPreview = () => {
    if (!generatedContent) return null;
    if (generatedContent.platform === 'instagram') return (
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-sm mx-auto">
        <div className="flex items-center gap-3 p-3 border-b border-gray-100">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 via-pink-600 to-orange-400 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">NM</span>
          </div>
          <div className="flex-1"><p className="font-medium text-sm">numeraai_official</p><p className="text-xs text-gray-500">Sponsored</p></div>
        </div>
        {generatedContent.imageUrl && <div className="aspect-square bg-gray-100"><ImageWithFallback src={generatedContent.imageUrl} alt="Generated" className="w-full h-full object-cover" /></div>}
        <div className="p-3">
          <p className="text-sm mb-2 whitespace-pre-line line-clamp-4">{generatedContent.content}</p>
          <div className="flex flex-wrap gap-1 mb-2">{generatedContent.hashtags.slice(0, 3).map((tag, i) => <span key={i} className="text-blue-600 text-xs">{tag}</span>)}</div>
          <p className="text-xs text-gray-500">2 minutes ago</p>
        </div>
      </div>
    );
    if (generatedContent.platform === 'twitter') return (
      <div className="bg-white rounded-lg border border-gray-200 p-4 max-w-lg mx-auto">
        <div className="flex gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0"><span className="text-white text-sm font-bold">NM</span></div>
          <div className="flex-1">
            <div className="flex items-center gap-1 mb-1"><span className="font-medium text-sm">NumeraAI</span><span className="text-blue-500">✓</span><span className="text-gray-500 text-sm">@numeraai · 2m</span></div>
            <p className="text-sm whitespace-pre-line">{generatedContent.content}</p>
            {generatedContent.imageUrl && <div className="rounded-lg overflow-hidden border border-gray-200 mt-2"><ImageWithFallback src={generatedContent.imageUrl} alt="Generated" className="w-full h-48 object-cover" /></div>}
          </div>
        </div>
      </div>
    );
    if (generatedContent.platform === 'linkedin') return (
      <div className="bg-white rounded-lg border border-gray-200 max-w-lg mx-auto">
        <div className="p-4">
          <div className="flex gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center"><span className="text-white text-sm font-bold">NM</span></div>
            <div><p className="font-medium text-sm">NumeraAI</p><p className="text-xs text-gray-500">AI Business Solutions · 2nd</p><p className="text-xs text-gray-500">2 minutes ago</p></div>
          </div>
          <p className="text-sm mb-3 whitespace-pre-line">{generatedContent.content}</p>
          {generatedContent.imageUrl && <div className="rounded-lg overflow-hidden border border-gray-200"><ImageWithFallback src={generatedContent.imageUrl} alt="Generated" className="w-full h-48 object-cover" /></div>}
        </div>
      </div>
    );
    return null;
  };

  const renderPreview = () => {
    if (!generatedContent) return null;
    const PlatformIcon = getPlatformIcon(generatedContent.platform);
    return (
      <Card className="rounded-lg border-2 border-[#00C4B4]/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="w-8 h-8 bg-[#00C4B4] rounded-full flex items-center justify-center"><PlatformIcon className="w-4 h-4 text-white" /></div>
              {generatedContent.platform.charAt(0).toUpperCase() + generatedContent.platform.slice(1)} {generatedContent.type}
            </CardTitle>
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">{generatedContent.source === 'ai' ? '✦ AI generated' : 'template'}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderPlatformPreview()}
          {generatedContent.hashtags.length > 0 && (
            <div className="flex flex-wrap gap-2">{generatedContent.hashtags.map((tag, i) => <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>)}</div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => setGeneratedContent(null)}>Generate New</Button>
            <Button onClick={() => setShowShareModal(true)} className="flex-1 bg-[#00C4B4] hover:bg-[#00B3A6] text-white h-12"><Share2 className="w-4 h-4 mr-2" />Share</Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="p-2"><ArrowLeft className="w-5 h-5" /></Button>
        <div><h2 className="text-lg font-semibold">Create Content</h2><p className="text-xs text-muted-foreground">Pick a goal and we'll handle the rest</p></div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /><p>{errorMsg}</p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">What's your goal?</p>
        <div className="grid grid-cols-2 gap-2">
          {goals.map(goal => {
            const isSelected = selectedGoal?.id === goal.id;
            return (
              <button key={goal.id} onClick={() => setSelectedGoal(isSelected ? null : goal)}
                className={`relative overflow-hidden rounded-xl p-3 text-left transition-all duration-200 border-2 ${isSelected ? 'border-[#00C4B4] bg-[#00C4B4]/5 shadow-md' : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:shadow-sm'}`}>
                <p className="text-xs font-semibold leading-tight">{goal.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{goal.sublabel}</p>
                {isSelected && <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#00C4B4] flex items-center justify-center"><span className="text-white text-[9px] font-bold">✓</span></div>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tone</Label>
        <div className="grid grid-cols-3 gap-2">
          {tones.map(t => {
            const isSelected = tone === t.value;
            return (
              <button key={t.value} onClick={() => setTone(isSelected ? '' : t.value)}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all duration-150 ${isSelected ? 'border-[#00C4B4] bg-[#00C4B4] text-white shadow-sm' : 'border-gray-200 text-muted-foreground hover:border-gray-300 hover:text-foreground'}`}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          What are you promoting? <span className="normal-case font-normal ml-1">({description.length}/200)</span>
        </Label>
        <Textarea placeholder="e.g. My new M-Pesa payment feature, weekend sale on clothes…" value={description}
          onChange={e => { if (e.target.value.length <= 200) setDescription(e.target.value); }}
          className="rounded-xl resize-none text-sm" rows={3} />
      </div>

      <Button onClick={generateContent} disabled={!selectedGoal || !tone || !description.trim() || isGenerating}
        className="w-full bg-[#00C4B4] hover:bg-[#00B3A6] disabled:opacity-40 text-white rounded-xl h-12 font-semibold text-sm shadow-md transition-all">
        {isGenerating ? (
          <div className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</div>
        ) : (
          <div className="flex items-center gap-2"><Sparkles className="w-4 h-4" />{selectedGoal ? `Generate — ${selectedGoal.label}` : 'Generate Content'}</div>
        )}
      </Button>

      {generatedContent && <div className="space-y-2"><Label>Generated Content Preview</Label>{renderPreview()}</div>}

      <Dialog open={showShareModal} onOpenChange={setShowShareModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Share2 className="w-5 h-5" />Share Content</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Twitter, LinkedIn & WhatsApp open directly. Instagram opens the app (mobile) or website (desktop).</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'instagram', label: 'Instagram', sub: 'Opens app / web', icon: <Instagram className="w-5 h-5 text-white" />, bg: 'bg-gradient-to-br from-purple-600 via-pink-600 to-orange-400' },
                { id: 'twitter',   label: 'Twitter / X', sub: 'Opens compose',  icon: <Twitter className="w-5 h-5 text-white" />,   bg: 'bg-black' },
                { id: 'linkedin',  label: 'LinkedIn',   sub: 'Opens share',    icon: <Linkedin className="w-5 h-5 text-white" />,  bg: 'bg-blue-600' },
                { id: 'whatsapp',  label: 'WhatsApp',   sub: 'Opens app',
                  icon: <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
                  bg: 'bg-green-500' },
              ].map(({ id, label, sub, icon, bg }) => (
                <button key={id} onClick={() => handleShare(id)} className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
                  <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>{icon}</div>
                  <div className="text-left"><p className="text-sm font-semibold">{label}</p><p className="text-[10px] text-muted-foreground">{sub}</p></div>
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => setShowShareModal(false)} className="w-full">Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}