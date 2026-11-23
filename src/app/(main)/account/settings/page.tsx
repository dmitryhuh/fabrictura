import { PageHead, SoonRow } from "@/components/AccountUi";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <PageHead title="Настройки" />
      <div className="space-y-2">
        <SoonRow label="Тема сайта" hint="Светлая, тёмная, свои цвета" />
        <SoonRow label="Анимации" />
      </div>
    </div>
  );
}