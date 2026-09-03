import { OrganizationDetail } from '../../../../components/OrganizationDetail';

export default async function PharmacyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrganizationDetail id={id} backHref="/pharmacies" backLabel="Back to pharmacies" />;
}
