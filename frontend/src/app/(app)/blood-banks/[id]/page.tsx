import { OrganizationDetail } from '../../../../components/OrganizationDetail';

export default async function BloodBankDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrganizationDetail id={id} backHref="/blood-banks" backLabel="Back to blood banks" />;
}
