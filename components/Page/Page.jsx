import * as Shared from "../shared.js";
import Dashboard from "../Dashboard/Dashboard.jsx";
import CasesPage from "../CasesPage/CasesPage.jsx";
import AnalysisPage from "../AnalysisPage/AnalysisPage.jsx";
import CorrelationPage from "../CorrelationPage/CorrelationPage.jsx";
import InspectorsPage from "../InspectorsPage/InspectorsPage.jsx";
import AddCase from "../AddCase/AddCase.jsx";
import AssistantPage from "../AssistantPage/AssistantPage.jsx";
import ReportsPage from "../ReportsPage/ReportsPage.jsx";
import SettingsPage from "../SettingsPage/SettingsPage.jsx";
const { Settings } = Shared;

function Page({
  page,
  refreshKey,
  caseFilters,
  onNavigate,
  onOpenCase,
  onNotify,
  onRefresh,
}) {
  if (page === "Dashboard")
    return (
      <Dashboard
        refreshKey={refreshKey}
        onNavigate={onNavigate}
        onOpenCase={onOpenCase}
      />
    );
  if (page === "Cases")
    return (
      <CasesPage
        refreshKey={refreshKey}
        initialFilters={caseFilters}
        onOpenCase={onOpenCase}
      />
    );
  if (page === "AI Case Analysis")
    return (
      <AnalysisPage
        refreshKey={refreshKey}
        onOpenCase={onOpenCase}
        onNotify={onNotify}
        onRefresh={onRefresh}
      />
    );
  if (page === "Case Correlation")
    return (
      <CorrelationPage
        refreshKey={refreshKey}
        onOpenCase={onOpenCase}
        onNotify={onNotify}
        onNavigate={onNavigate}
        onRefresh={onRefresh}
      />
    );
  if (page === "Inspectors")
    return <InspectorsPage refreshKey={refreshKey} onNotify={onNotify} />;
  if (page === "Add Case")
    return <AddCase onOpenCase={onOpenCase} onNotify={onNotify} />;
  if (page === "AI Assistant") return <AssistantPage />;
  if (page === "Reports") return <ReportsPage refreshKey={refreshKey} />;
  if (page === "Settings")
    return (
      <SettingsPage
        refreshKey={refreshKey}
        onNotify={onNotify}
        onRefresh={onRefresh}
      />
    );
  return null;
}

export default Page;
