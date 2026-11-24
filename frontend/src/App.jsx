import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Project from './pages/Project';
import Deployment from './pages/Deployment';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/project/:id" element={<Project />} />
          <Route path="/deployment/:deploymentId" element={<Deployment />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
