import AppHeader from "../components/AppHeader";
import CollectorAnalysis from "../features/collector/components/CollectorAnalysis";

export default function CollectorPage() {
    return (
        <div className="collector-page-wrapper collector-page-wrapper--collector">
            <AppHeader title="Average Collector Value" />
            <main className="collector-page collector-page-columns collector-page--collector">
                <CollectorAnalysis />
            </main>
        </div>
    );
}
