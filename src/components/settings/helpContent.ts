export interface HelpStep {
  stepNumber: number;
  title: string;
  description: string;
  actionButton?: { label: string; href: string; isAffiliateLink?: boolean };
}

export interface HelpDrawerContent {
  provider: string;
  title: string;
  estimatedSetupTime: string;
  steps: HelpStep[];
  faq: { question: string; answer: string }[];
  troubleshooting: { issue: string; solution: string }[];
  docsUrl: string;
}

export const UPLOAD_POST_HELP: HelpDrawerContent = {
  provider: "upload_post",
  title: "Connect Upload-Post",
  estimatedSetupTime: "5 minutes",
  steps: [
    {
      stepNumber: 1,
      title: "Create your Upload-Post account",
      description:
        "Upload-Post lets you publish to Instagram, TikTok, LinkedIn, and 6 more platforms from one place. Sign up for a free account to get started.",
      actionButton: {
        label: "Sign Up for Upload-Post →",
        href: "upload_post",
        isAffiliateLink: true,
      },
    },
    {
      stepNumber: 2,
      title: "Verify your email",
      description:
        "Check your inbox for a verification email from Upload-Post and confirm your account before proceeding.",
    },
    {
      stepNumber: 3,
      title: "Find your API key",
      description:
        'Once logged in, go to your Upload-Post dashboard and look for "API Keys" or "Developer Settings" in the account menu.',
    },
    {
      stepNumber: 4,
      title: "Copy your API key",
      description:
        "Click the copy icon next to your API key. Keep this private — treat it like a password. Do not share it with anyone.",
    },
    {
      stepNumber: 5,
      title: "Paste it into IGCloner",
      description:
        "Come back to this page, paste your API key into the Upload-Post field above, and click Save & Validate.",
    },
    {
      stepNumber: 6,
      title: "Confirm the connection",
      description:
        "IGCloner automatically checks that your key works. You'll see a green \"Connected\" badge once it's confirmed.",
    },
    {
      stepNumber: 7,
      title: "Connect your social accounts",
      description:
        'Go to Social Accounts in Settings and click "Connect More." You\'ll be sent to Upload-Post to securely link Instagram, TikTok, LinkedIn, and any other platforms you use.',
      actionButton: { label: "Go to Social Accounts →", href: "/settings?section=social-accounts" },
    },
    {
      stepNumber: 8,
      title: "Authorize each platform",
      description:
        "Upload-Post will walk you through logging into each social platform and granting permission. This happens on Upload-Post's secure site — IGCloner never sees your social media passwords.",
    },
    {
      stepNumber: 9,
      title: "Return to IGCloner",
      description:
        "After connecting your accounts, you'll be redirected back here automatically. Your accounts will sync within a few seconds.",
    },
    {
      stepNumber: 10,
      title: "Start publishing",
      description:
        "You're all set! Head to any project and click Publish to post directly to your connected platforms.",
      actionButton: { label: "Go to Publishing Center →", href: "/publishing" },
    },
  ],
  faq: [
    {
      question: "Is Upload-Post free?",
      answer:
        "Upload-Post offers a free tier with limited monthly uploads. Paid plans unlock higher limits and additional platforms.",
    },
    {
      question: "Does IGCloner see my social media passwords?",
      answer:
        "No. All authentication happens directly on Upload-Post's secure platform. IGCloner only stores connection status, never your credentials.",
    },
    {
      question: "Can I disconnect a platform later?",
      answer: "Yes, anytime from the Social Accounts page in Settings.",
    },
    {
      question: "What if I already have an Upload-Post account?",
      answer:
        "Just grab your existing API key from your Upload-Post dashboard and paste it in — no need to create a new account.",
    },
  ],
  troubleshooting: [
    {
      issue: 'My API key shows as "Invalid"',
      solution:
        "Double-check you copied the entire key with no extra spaces. API keys are case-sensitive.",
    },
    {
      issue: "I connected a platform but it's not showing in IGCloner",
      solution: 'Click "Refresh" on the Social Accounts page to sync the latest connection status.',
    },
    {
      issue: 'My connection shows "Requires Attention"',
      solution:
        'This usually means a platform token expired. Click "Reconnect" next to that platform.',
    },
  ],
  docsUrl: "https://docs.upload-post.com/",
};

export const ELEVENLABS_HELP: HelpDrawerContent = {
  provider: "elevenlabs",
  title: "Connect ElevenLabs",
  estimatedSetupTime: "3 minutes",
  steps: [
    {
      stepNumber: 1,
      title: "Create or log in to ElevenLabs",
      description:
        "ElevenLabs provides AI-powered voice generation for your Reels. A free account gives you a monthly character allowance.",
      actionButton: { label: "Open ElevenLabs →", href: "elevenlabs", isAffiliateLink: true },
    },
    {
      stepNumber: 2,
      title: "Go to your Profile",
      description:
        'Click your profile icon in the top-right corner and select "Profile + API key".',
    },
    {
      stepNumber: 3,
      title: "Copy your API key",
      description:
        'Find your API key in the Profile section and click "Copy". Keep this key private.',
    },
    {
      stepNumber: 4,
      title: "Paste it into IGCloner",
      description:
        "Come back here, paste your key into the ElevenLabs field above, and click Save & Validate.",
    },
  ],
  faq: [
    {
      question: "What is ElevenLabs used for in IGCloner?",
      answer:
        "ElevenLabs generates realistic AI voiceovers for your Reels inside the Voiceover Studio.",
    },
    {
      question: "Do I need a paid ElevenLabs plan?",
      answer:
        "The free tier provides a monthly character limit. For high-volume voiceover generation, a paid plan is recommended.",
    },
  ],
  troubleshooting: [
    {
      issue: 'ElevenLabs shows "Invalid Key"',
      solution: "Make sure you copied the full API key from the Profile page, not a model ID.",
    },
  ],
  docsUrl: "https://docs.elevenlabs.io/",
};

export const ANTHROPIC_HELP: HelpDrawerContent = {
  provider: "anthropic",
  title: "Connect Anthropic (Claude)",
  estimatedSetupTime: "3 minutes",
  steps: [
    {
      stepNumber: 1,
      title: "Open the Anthropic Console",
      description:
        "Claude powers IGCloner's content analysis and angle generation. You need an Anthropic account with billing enabled.",
      actionButton: { label: "Open Anthropic Console →", href: "anthropic" },
    },
    {
      stepNumber: 2,
      title: "Go to API Keys",
      description:
        'In the Anthropic Console, click "API Keys" in the left sidebar and then "Create Key".',
    },
    {
      stepNumber: 3,
      title: "Copy your API key",
      description:
        "Copy the key immediately — it will only be shown once. Store it somewhere secure before pasting it here.",
    },
    {
      stepNumber: 4,
      title: "Paste it into IGCloner",
      description: "Paste the key into the Anthropic field above and click Save & Validate.",
    },
  ],
  faq: [
    {
      question: "Why does IGCloner need an Anthropic key?",
      answer:
        "Claude analyzes content, generates captions, extracts viral angles, and powers the AI features throughout the app.",
    },
  ],
  troubleshooting: [
    {
      issue: 'Anthropic shows "Invalid Key"',
      solution:
        "Verify your key in the Anthropic Console. Keys start with 'sk-ant-'. Make sure billing is set up.",
    },
  ],
  docsUrl: "https://docs.anthropic.com/",
};

export const HELP_CONTENT: Record<string, HelpDrawerContent> = {
  upload_post: UPLOAD_POST_HELP,
  elevenlabs: ELEVENLABS_HELP,
  anthropic: ANTHROPIC_HELP,
};

// ── Generic API key providers without a dedicated walkthrough above. ──

export const OPENAI_HELP: HelpDrawerContent = {
  provider: "openai",
  title: "Connect OpenAI",
  estimatedSetupTime: "3 minutes",
  steps: [
    {
      stepNumber: 1,
      title: "Open the OpenAI dashboard",
      description:
        "OpenAI powers extra AI models inside IGCloner (image generation, alternate text models). You need an OpenAI account with billing enabled — the free trial credit usually works to start.",
      actionButton: { label: "Open OpenAI Platform →", href: "https://platform.openai.com/" },
    },
    {
      stepNumber: 2,
      title: "Go to API Keys",
      description:
        'In the left sidebar click "API keys". If you don\'t see it, click your profile icon → "View API keys".',
    },
    {
      stepNumber: 3,
      title: 'Click "Create new secret key"',
      description:
        'Give the key a name like "IGCloner". Choose the default "All" permission unless you know you need to limit it.',
    },
    {
      stepNumber: 4,
      title: "Copy the key right away",
      description:
        "OpenAI only shows the key one time. Copy it the moment it appears — if you lose it you'll have to create a new one. Keys start with `sk-…`.",
    },
    {
      stepNumber: 5,
      title: "Paste it into IGCloner",
      description:
        "Come back to this page, paste the key into the OpenAI field, and click Save & Validate. You'll see a green Connected badge if it worked.",
    },
  ],
  faq: [
    {
      question: "Do I need to add a credit card to OpenAI?",
      answer:
        "Yes for most accounts. OpenAI gives a small free trial, but ongoing use requires billing to be set up.",
    },
    {
      question: "Is OpenAI required?",
      answer: "No — it's optional. Anthropic (Claude) handles the core AI work. OpenAI unlocks extras.",
    },
  ],
  troubleshooting: [
    {
      issue: 'OpenAI shows "Invalid Key"',
      solution:
        "Make sure the key starts with `sk-`, there are no spaces, and billing is enabled in your OpenAI account.",
    },
  ],
  docsUrl: "https://platform.openai.com/docs/api-reference/authentication",
};

export const APIFY_HELP: HelpDrawerContent = {
  provider: "apify",
  title: "Connect Apify",
  estimatedSetupTime: "3 minutes",
  steps: [
    {
      stepNumber: 1,
      title: "Create or log in to Apify",
      description:
        "Apify scrapes social profiles so IGCloner can do competitive research and content discovery. The free plan is enough to get started.",
      actionButton: { label: "Open Apify →", href: "https://console.apify.com/sign-up" },
    },
    {
      stepNumber: 2,
      title: "Open Settings → Integrations",
      description:
        'In the Apify console click your avatar (top-right) → "Settings" → "Integrations" in the left menu.',
    },
    {
      stepNumber: 3,
      title: "Copy your Personal API token",
      description:
        'Find the section labeled "Personal API tokens" and click the copy icon next to your token. Keep it private — it acts like a password.',
    },
    {
      stepNumber: 4,
      title: "Paste it into IGCloner",
      description:
        "Come back here, paste the token into the Apify field, and click Save & Validate.",
    },
  ],
  faq: [
    {
      question: "What does IGCloner use Apify for?",
      answer:
        "It powers competitor lookups and pulls public profile data when you analyze a new account.",
    },
    {
      question: "Will Apify charge me?",
      answer:
        "Apify gives a free monthly platform credit. Heavy scraping may exceed it; check your Apify usage page.",
    },
  ],
  troubleshooting: [
    {
      issue: 'Apify shows "Invalid Key"',
      solution:
        "Double-check you copied the Personal API token (not an actor task token). Tokens are usually 25+ characters with no dashes.",
    },
  ],
  docsUrl: "https://docs.apify.com/platform/integrations/api",
};

export const NANO_BANANA_HELP: HelpDrawerContent = {
  provider: "nano_banana",
  title: "Nano Banana — Coming Soon",
  estimatedSetupTime: "—",
  steps: [
    {
      stepNumber: 1,
      title: "Not available yet",
      description:
        "Nano Banana is a scheduling and automation tool we're integrating soon. There's nothing to connect right now. We'll send you an email when it's live and unlock the connect button here.",
    },
  ],
  faq: [
    {
      question: "What will Nano Banana do?",
      answer:
        "Advanced scheduling rules, posting bursts, and automation flows that run on top of your existing connected accounts.",
    },
  ],
  troubleshooting: [],
  docsUrl: "https://lovable.dev/",
};

HELP_CONTENT.openai = OPENAI_HELP;
HELP_CONTENT.apify = APIFY_HELP;
HELP_CONTENT.nano_banana = NANO_BANANA_HELP;

// ── Per-platform help shown from the Social Accounts page. ──

function uploadPostConnectStep(platformLabel: string): HelpStep {
  return {
    stepNumber: 1,
    title: "Make sure Upload-Post is connected first",
    description:
      "IGCloner publishes through Upload-Post. If you haven't connected it yet, go to Settings → API Keys and paste your Upload-Post API key before continuing.",
    actionButton: { label: "Go to API Keys →", href: "/settings?section=api-keys" },
  };
}

function commonConnectSteps(platformLabel: string, extra: HelpStep[] = []): HelpStep[] {
  return [
    uploadPostConnectStep(platformLabel),
    {
      stepNumber: 2,
      title: `Click "Connect" next to ${platformLabel}`,
      description: `On the Social Accounts page, find the ${platformLabel} row and click the Connect button. A new tab will open on Upload-Post's secure site.`,
    },
    {
      stepNumber: 3,
      title: `Log in to ${platformLabel}`,
      description: `In the new tab, sign in with the ${platformLabel} account you want to publish from. IGCloner never sees your password — login happens directly with ${platformLabel}.`,
    },
    {
      stepNumber: 4,
      title: "Approve the permissions",
      description: `${platformLabel} will ask you to allow Upload-Post to post on your behalf. Read the list and click Allow / Authorize. If you skip a permission, posting may fail later.`,
    },
    ...extra,
    {
      stepNumber: 5 + extra.length,
      title: "Come back and refresh",
      description:
        'Close the popup and return to this page. Click the "Refresh" button at the top right — your account should now show a green Connected badge.',
    },
  ];
}

function basicTroubleshooting(platformLabel: string) {
  return [
    {
      issue: "The popup never opened",
      solution:
        "Your browser blocked it. Allow popups for this site (look for a small icon in the URL bar) and click Connect again.",
    },
    {
      issue: `${platformLabel} still shows "Not connected" after I finished`,
      solution: 'Click the "Refresh" button at the top of the Social Accounts page. Connections can take a few seconds to sync.',
    },
    {
      issue: `${platformLabel} shows "Requires Attention"`,
      solution: `Your token expired or a permission was revoked. Click Connect on the ${platformLabel} row to reconnect.`,
    },
  ];
}

function makePlatformHelp(
  key: string,
  label: string,
  notes: string,
  extraSteps: HelpStep[] = [],
): HelpDrawerContent {
  return {
    provider: `platform_${key}`,
    title: `Connect ${label}`,
    estimatedSetupTime: "2 minutes",
    steps: commonConnectSteps(label, extraSteps),
    faq: [
      {
        question: `Does IGCloner see my ${label} password?`,
        answer:
          "No. You sign in directly with the platform. IGCloner and Upload-Post only receive a token that lets us post on your behalf.",
      },
      {
        question: "Can I disconnect later?",
        answer: `Yes. Open Settings → Social Accounts, find the ${label} row, and click Manage to remove the connection.`,
      },
      { question: `Anything special about ${label}?`, answer: notes },
    ],
    troubleshooting: basicTroubleshooting(label),
    docsUrl: "https://docs.upload-post.com/",
  };
}

export const PLATFORM_HELP: Record<string, HelpDrawerContent> = {
  instagram: makePlatformHelp(
    "instagram",
    "Instagram",
    "Instagram requires a Business or Creator account connected to a Facebook Page. If login fails, open the Instagram app, go to Settings → Account → Switch to Professional Account.",
  ),
  tiktok: makePlatformHelp(
    "tiktok",
    "TikTok",
    "TikTok must approve the connection inside its own app on first use. Keep your phone nearby in case TikTok sends a confirmation prompt.",
  ),
  youtube: makePlatformHelp(
    "youtube",
    "YouTube",
    "Choose the Google account that owns your YouTube channel. If you manage a Brand Account, pick that channel on the Google selector screen.",
  ),
  facebook: makePlatformHelp(
    "facebook",
    "Facebook",
    "Facebook posts go to a Page, not your personal profile. After connecting, click 'Choose Page' on the Facebook row to pick which Page to publish to.",
    [
      {
        stepNumber: 5,
        title: "Pick the Facebook Page to publish to",
        description:
          'After connecting, the Facebook row shows a "Choose Page" button. Click it and pick which Page IGCloner should post to. You can change this later.',
      },
    ],
  ),
  linkedin: makePlatformHelp(
    "linkedin",
    "LinkedIn",
    "By default we post to your personal profile. To publish to a Company Page, click 'Choose Org' on the LinkedIn row after connecting and pick the organization.",
  ),
  x: makePlatformHelp(
    "x",
    "X (Twitter)",
    "X may ask you to re-authorize every 90 days. If posts start failing, just click Connect again to refresh the token.",
  ),
  threads: makePlatformHelp(
    "threads",
    "Threads",
    "Threads uses your Instagram login. If your Instagram is already connected here, the Threads connection should work in seconds.",
  ),
  pinterest: makePlatformHelp(
    "pinterest",
    "Pinterest",
    "Pinterest needs a Board to publish to. After connecting, click 'Choose Board' on the Pinterest row and select your default board.",
    [
      {
        stepNumber: 5,
        title: "Pick a default Pinterest board",
        description:
          'After connecting, the Pinterest row shows a "Choose Board" button. Click it and pick the board IGCloner should pin to. You can switch boards anytime.',
      },
    ],
  ),
  bluesky: makePlatformHelp(
    "bluesky",
    "Bluesky",
    "Bluesky uses an app password, not your regular password. Generate one at https://bsky.app/settings/app-passwords if asked.",
  ),
  reddit: makePlatformHelp(
    "reddit",
    "Reddit",
    "Reddit only supports text posts through IGCloner. You'll also pick which subreddit to post to at publish time.",
  ),
  discord: makePlatformHelp(
    "discord",
    "Discord",
    "Discord posts through a webhook in a specific channel. Make sure you have the 'Manage Webhooks' permission in the server you connect.",
  ),
  telegram: makePlatformHelp(
    "telegram",
    "Telegram",
    "Telegram posts through a bot you authorize during connection. The bot must be added to the channel or group you want to post to.",
  ),
};
