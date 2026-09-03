import { ComplaintDetail } from './ComplaintDetail';

export default async function ComplaintDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ComplaintDetail id={id} />;
}
