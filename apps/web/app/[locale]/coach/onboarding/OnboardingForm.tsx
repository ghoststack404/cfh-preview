"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageUploader from '@/components/ImageUploader';

export default function OnboardingForm() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    headline: '',
    biography: '',
    yearsExperience: '',
    hourlyRate: '',
    profilePhoto: null as File | null,
  });

  const nextStep = () => {
    setStep((prev) => Math.min(prev + 1, 3));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleComplete = () => {
    console.log("Datos de Onboarding recopilados:", formData);
    alert("Perfil completado (Revisa la consola para ver los datos)");
  };

  const variants = {
    initial: { x: 30, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -30, opacity: 0 },
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-xl border border-gray-100">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800">Completa tu Perfil de Coach</h2>
        <p className="text-gray-500 text-sm mt-2">Paso {step} de 3</p>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-100 h-2.5 rounded-full mt-4 overflow-hidden">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="relative min-h-[350px]">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="flex flex-col space-y-5"
            >
              <h3 className="text-xl font-semibold text-gray-700">Información Básica</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Headline (Título Profesional)</label>
                <input 
                  type="text" 
                  value={formData.headline}
                  onChange={(e) => setFormData({...formData, headline: e.target.value})}
                  placeholder="Ej: Coach Ejecutivo y Liderazgo" 
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Biografía</label>
                <textarea 
                  rows={5}
                  value={formData.biography}
                  onChange={(e) => setFormData({...formData, biography: e.target.value})}
                  placeholder="Cuéntanos sobre ti y tu experiencia..."
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow resize-none"
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="flex flex-col space-y-5"
            >
              <h3 className="text-xl font-semibold text-gray-700">Experiencia y Tarifas</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Años de Experiencia</label>
                <input 
                  type="number" 
                  min="0"
                  value={formData.yearsExperience}
                  onChange={(e) => setFormData({...formData, yearsExperience: e.target.value})}
                  placeholder="Ej: 5" 
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa por hora (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-gray-500 font-medium">$</span>
                  <input 
                    type="number" 
                    min="0"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({...formData, hourlyRate: e.target.value})}
                    placeholder="50.00" 
                    className="w-full p-3 pl-8 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-shadow"
                  />
                </div>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="flex flex-col space-y-5 items-center"
            >
              <div className="w-full text-left">
                <h3 className="text-xl font-semibold text-gray-700">Foto de Perfil</h3>
                <p className="text-sm text-gray-500 mt-1 mb-4">
                  Sube una foto profesional para que tus clientes te reconozcan.
                </p>
              </div>
              
              <ImageUploader 
                onChange={(_url, file) => setFormData({...formData, profilePhoto: file || null})} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-8 flex justify-between pt-6 border-t border-gray-100">
        <button
          onClick={prevStep}
          disabled={step === 1}
          className={`px-6 py-2.5 rounded-xl font-medium transition-colors ${
            step === 1 
              ? 'text-gray-300 cursor-not-allowed' 
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          Atrás
        </button>

        {step < 3 ? (
          <button
            onClick={nextStep}
            className="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 hover:shadow-md transition-all active:scale-95"
          >
            Siguiente
          </button>
        ) : (
          <button
            onClick={handleComplete}
            className="px-8 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 hover:shadow-md transition-all active:scale-95"
          >
            Completar Perfil
          </button>
        )}
      </div>
    </div>
  );
}
