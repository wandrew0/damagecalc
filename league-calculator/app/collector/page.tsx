import Navigation from "../components/Navigation";
import CollectorAnalysis from "../components/CollectorAnalysis";
import "../styles/CalculatorPage.css";
import "../styles/CollectorPage.css";

export default function CollectorPage() {
    return (
        <div className="collector-page-wrapper">
            <div className="headerContainer">
                <div className="headerTop">
                    <div className="headerTitleRow">
                        <Navigation className="header-nav" />
                        <h1>Average Collector Value</h1>
                    </div>
                </div>
            </div>
            <main className="collector-page">
                <CollectorAnalysis />
            </main>
        </div>
    );
}
