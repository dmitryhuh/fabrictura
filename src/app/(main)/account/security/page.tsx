import { EditTabs, PageHead, SoonRow } from "@/components/AccountUi";

export default function SecurityPage() {
  return (
    <div className="space-y-4">
      <PageHead title="Безопасность" />
      <EditTabs />
      <div className="space-y-2">
        <SoonRow label="Сброс аккаунта" hint="Очистка постов, подписок и данных профиля" />
        <SoonRow label="Смена пароля" />
      </div>
    </div>
  );
}