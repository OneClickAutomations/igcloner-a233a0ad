export type PostGoal =
  | "grow_followers"
  | "build_authority"
  | "drive_traffic_link"
  | "increase_engagement"
  | "drive_sales"
  | "attract_brand_deals"
  | "grow_email_list"
  | "build_community";

export interface GoalOption {
  id: PostGoal;
  emoji: string;
  label: string;
  description: string;
}

export const POST_GOALS: GoalOption[] = [
  { id: "grow_followers", emoji: "📈", label: "Grow Followers", description: "Optimize for shareability and reach — content people want to share with friends" },
  { id: "build_authority", emoji: "🎯", label: "Build Authority", description: "Position you as the expert — confident, knowledgeable tone with credibility signals" },
  { id: "drive_traffic_link", emoji: "🔗", label: "Drive Traffic to Link in Bio", description: "Strong curiosity gap that requires clicking through to resolve" },
  { id: "increase_engagement", emoji: "💬", label: "Increase Engagement", description: "Built-in discussion triggers — questions, polarizing takes, save-worthy value" },
  { id: "drive_sales", emoji: "💰", label: "Drive Sales / Conversions", description: "Direct value proposition with soft or hard CTA toward product/service" },
  { id: "attract_brand_deals", emoji: "🤝", label: "Attract Brand Deals", description: "Showcase audience connection and content quality — appeals to potential sponsors" },
  { id: "grow_email_list", emoji: "📧", label: "Grow Email List", description: "CTA directs to lead magnet or newsletter signup" },
  { id: "build_community", emoji: "🌱", label: "Build Community", description: "Inclusive, conversational tone — invites people to feel part of something" },
];

export const GOAL_LABEL: Record<PostGoal, string> = Object.fromEntries(
  POST_GOALS.map((g) => [g.id, g.label]),
) as Record<PostGoal, string>;

export const GOAL_COPY_INSTRUCTIONS: Record<PostGoal, string> = {
  grow_followers: `OPTIMIZE FOR: Shareability and algorithmic reach.
- Hook must work even out of context (for non-followers seeing it via Explore/Reels)
- Caption should feel universally relatable within the niche
- CTA: "Follow for more [specific value]" — be specific about what they'll get
- Hashtag mix: heavier on broad reach tags (500K+ posts) to maximize discovery`,

  build_authority: `OPTIMIZE FOR: Establishing expertise and credibility.
- Hook should reference experience, data, or a specific credential/result
- Caption tone: confident, declarative, avoid hedging language
- Include a specific number, timeframe, or proof point if possible
- CTA: invite questions or position as the go-to resource — "Save this for when you need it"
- Hashtag mix: niche authority tags + industry-specific terms`,

  drive_traffic_link: `OPTIMIZE FOR: Clicking the link in bio.
- Hook must create a curiosity gap that ONLY resolves by clicking through
- Caption should explicitly reference "link in bio" naturally — not forced
- Do not give away the full value in the caption — tease it
- CTA: explicit and clear — "Full guide linked in bio" / "Link in bio for the complete breakdown"
- Hashtag mix: balanced, include action-oriented tags`,

  increase_engagement: `OPTIMIZE FOR: Comments and saves.
- Hook should include a debatable or polarizing (but defensible) angle
- Caption should end with a direct question the audience can answer in comments
- Include "save this" language naturally tied to genuine practical value
- CTA: ask a specific, easy-to-answer question — not "thoughts?" but "which one are you, 1 or 2?"
- Hashtag mix: niche-specific to attract the right commenters`,

  drive_sales: `OPTIMIZE FOR: Conversions toward a product or service.
- Hook should address a pain point the product/service solves
- Caption should build value before any mention of the offer
- CTA: clear next step — "DM me [keyword]" / "Link in bio to grab yours" / "Comment [word] for the link"
- Tone: confident but not pushy — value-first
- Hashtag mix: include buyer-intent and niche-specific tags`,

  attract_brand_deals: `OPTIMIZE FOR: Demonstrating audience quality and content professionalism to brands.
- Hook and caption should showcase strong personal voice and niche authority
- Content should feel premium and intentional, not rushed
- Avoid anything that looks unprofessional or amateur
- CTA: community-building rather than overtly sales — brands watch engagement quality
- Hashtag mix: niche + professional/industry tags`,

  grow_email_list: `OPTIMIZE FOR: Newsletter or lead magnet signups.
- Hook should hint at deeper value available "off-platform"
- Caption should reference a specific resource (checklist, guide, template) waiting via link
- CTA: explicit — "Get the free [resource] — link in bio"
- Tone: helpful, generous with the teaser, clear value exchange`,

  build_community: `OPTIMIZE FOR: Making the audience feel like insiders.
- Hook should use inclusive language ("we", "us", "you know exactly what I mean")
- Caption tone: warm, conversational, like talking to a friend
- CTA: invite people to share their own experience or tag a friend
- Hashtag mix: community/movement-style tags alongside niche tags`,
};