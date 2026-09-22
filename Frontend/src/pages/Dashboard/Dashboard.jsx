
import "./Dashboard.css";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import MaterialCard from "../../components/MaterialCard";
import StatCard from "../../components/StatCard";

import {
  FaBoxes,
  FaExclamationTriangle,
  FaGlobe,
  FaFire,
} from "react-icons/fa";

function Dashboard() {

    const navigate = useNavigate();

  const [materials, setMaterials] = useState([]);
  const [risks, setRisks] = useState([]);

 useEffect(() => {
  const fetchDashboard = async () => {
    try {
      const materialsResponse = await axios.get(
        "https://nao-ysu5.onrender.com/api/materials"
      );

      const risksResponse = await axios.get(
        "https://nao-ysu5.onrender.com/api/risks"
      );

      setMaterials(materialsResponse.data);
      setRisks(risksResponse.data);
    } catch (error) {
      console.log(error);
    }
  };

  fetchDashboard();
}, []);


  const highRisks = risks.filter(risk => risk.severity === "High").length;
  const countries = new Set(risks.map(risk => risk.location)).size;

  return (
    <>
  <div className="dashboard-header">

    
  </div>

  <div className="kpi-grid">
   
    <StatCard
      icon={<FaFire />}
      number={highRisks}
      title="Overall Risk Exposure"
      color="red"
       />

      <StatCard
       icon={<FaBoxes />}
       number={materials.length}
       title="Critical Materials"
       color="blue"
        />

      <StatCard
         icon={<FaGlobe />}
         number={countries}
         title="Affected Regions"
         color="green"
       />

       <StatCard
         icon={<FaExclamationTriangle />}
         number={risks.length}
         title="Active Risks"
         color="purple"
       />
  </div>

  <div className="executive-grid">

    <div className="top-risks">

      <h2>Top Supply Chain Risks</h2>

      {risks.slice(0,5).map((risk)=>(

        <div
          key={risk._id}
          className="risk-row"
        >

          <div>

            <h3>{risk.title}</h3>

            <p>{risk.materialId?.name}</p>

          </div>

          <div>

            <span className={`badge ${risk.severity.toLowerCase()}`}>
              {risk.severity}
            </span>

          </div>

        </div>

      ))}

    </div>

    <div className="business-impact">

      <h2>Business Impact</h2>

      <div className="impact-card">

        <h3>Critical Materials</h3>

        <h1>{materials.length}</h1>

      </div>

      <div className="impact-card">

        <h3>High Risk Events</h3>

        <h1>{highRisks}</h1>

      </div>

      <div className="impact-card">

        <h3>Regions Affected</h3>

        <h1>{countries}</h1>

      </div>

    </div>

  </div>

  <div className="materials-panel">

    <h2>Strategic Materials</h2>

    <div className="material-grid">

      {materials.map((material)=>(

        <div
          key={material._id}
          style={{cursor:"pointer"}}
          onClick={()=>navigate(`/materials/${material._id}`)}
        >

          <MaterialCard
            name={material.name}
            category={material.category}
            description={material.description}
            risk={
              material.riskScore >= 90
                ? "High"
                : material.riskScore >= 70
                ? "Medium"
                : "Low"
            }
          />

        </div>

      ))}

    </div>

  </div>
    </>
  );
}

export default Dashboard;
