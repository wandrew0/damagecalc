import AppHeader from "../components/AppHeader";
import ApheliosCutoffAnalysis from "../features/aphelios-cutoff/components/ApheliosCutoffAnalysis";
import "../styles/ApheliosCutoffPage.css";

export default function ApheliosCutoffPage() {
    return (
        <div className="collector-page-wrapper">
            <AppHeader title="Aphelios Q vs E" />
            <main className="collector-page">
                <ApheliosCutoffAnalysis />
            </main>
        </div>
    );
}
