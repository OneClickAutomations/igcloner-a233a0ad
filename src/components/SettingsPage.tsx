import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  User,
  CreditCard,
  Receipt,
  Key,
  Share2,
  Send,
  Sliders,
  BarChart2,
  Shield,
  HelpCircle,
  ChevronRight,
} from "lucide-react";
import { ProfileSection } from "./settings/ProfileSection";
import { SubscriptionSection } from "./settings/SubscriptionSection";
import { BillingSection } from "./settings/BillingSection";
import { ApiKeysSection } from "./settings/ApiKeysSection";
import { SocialAccountsSection } from "./settings/SocialAccountsSection";
import { PublishingSettingsSection } from "./settings/PublishingSettingsSection";
import { PreferencesSection } from "./settings/PreferencesSection";
import { UsageSection } from "./settings/UsageSection";
import { SecuritySection } from "./settings/SecuritySection";
import { HelpSection } from "./settings/HelpSection";
import { LaunchChecklist } from "./settings/LaunchChecklist";

const NAV_ITEMS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "subscription", label: "Subscription", icon: CreditCard },
  { key: "billing", label: "Billing", icon: Receipt },
  { key: "api-keys", label: "API Keys", icon: Key },
  { key: "social-accounts", label: "Social Accounts", icon: Share2 },
  { key: "publishing", label: "Publishing", icon: Send },
  { key: "preferences", label: "Preferences", icon: Sliders },
  { key: "usage", label: "Usage", icon: BarChart2 },
  { key: "security", label: "Security", icon: Shield },
  { key: "help", label: "Help & Resources", icon: HelpCircle },
] as const;

type Section = (typeof NAV_ITEMS)[number]["key"];

const SECTION_COMPONENTS: Record<Section, React.ComponentType> = {
  profile: ProfileSection,
  subscription: SubscriptionSection,
  billing: BillingSection,
  "api-keys": ApiKeysSection,
  "social-accounts": SocialAccountsSection,
  publishing: PublishingSettingsSection,
  preferences: PreferencesSection,
  usage: UsageSection,
  security: SecuritySection,
  help: HelpSection,
};

export function SettingsPage() {
  const search = useSearch({ from: "/_authenticated/settings" }) as { section?: string };
  const navigate = useNavigate();
  const active = (search.section as Section) ?? "profile";

  const setSection = (s: Section) =>
    navigate({ to: "/settings", search: { section: s } as any, replace: true });

  const ActiveComponent = SECTION_COMPONENTS[active] ?? ProfileSection;

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1100px] px-4 py-8 lg:py-12">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Settings & Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your account, API keys, and connected platforms.
          </p>
        </div>

        <LaunchChecklist />

        <div className="flex gap-8 items-start">
          {/* Left nav */}
          <aside className="hidden lg:block w-52 shrink-0">
            <nav className="space-y-0.5 sticky top-20">
              {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
                const isActive = active === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSection(key)}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? "bg-accent-primary/10 text-accent-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                    {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Mobile nav — horizontal scroll */}
          <div className="lg:hidden -mx-4 px-4 mb-6 w-full">
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
              {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setSection(key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                    active === key
                      ? "bg-accent-primary/10 text-accent-primary"
                      : "text-muted-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Right content panel */}
          <main className="flex-1 min-w-0">
            <ActiveComponent />
          </main>
        </div>
      </div>
    </div>
  );
}
