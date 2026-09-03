import { OrganizationDetail } from '../../../../components/OrganizationDetail';

export default async function FacilityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrganizationDetail id={id} backHref="/discover" backLabel="Back to nearby facilities" />;
}
