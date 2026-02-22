import Navigation from "../components/Navigation";
import ApheliosCutoffAnalysis from "../components/ApheliosCutoffAnalysis";
import "../styles/CalculatorPage.css";
import "../styles/CollectorPage.css";

export default function ApheliosCutoffPage() {
    return (
        <div className="collector-page-wrapper">
            <div className="headerContainer">
                <div className="headerTop">
                    <div className="headerTitleRow">
                        <Navigation className="header-nav" />
                        <h1>Aphelios Q vs E Cutoff</h1>
                    </div>
                </div>
            </div>
            <main className="collector-page">
                <ApheliosCutoffAnalysis />
            </main>
        </div>
    );
}
