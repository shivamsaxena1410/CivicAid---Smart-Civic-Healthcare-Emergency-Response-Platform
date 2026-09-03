import { OrganizationDetail } from '../../../../components/OrganizationDetail';

/**
 * `params` is a Promise in this Next.js version. Awaiting it in a small Server
 * Component keeps the interactive part a plain client component that just takes
 * an id.
 */
export default async function HospitalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrganizationDetail id={id} backHref="/hospitals" backLabel="Back to hospitals" />;
}
