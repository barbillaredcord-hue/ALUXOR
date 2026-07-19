import { useEffect, useState } from 'react';

export default function useCatalog({
  form,
  setForm,
  setActiveSection,
  activeWorkspace,
  hydratedWorkspaceId,
  catalogDefaults,
  defaultTypeDetails,
  StorageEngine,
  normalizeCatalogItem,
  numberValue,
  formatDimensions,
  typeOptionsFor,
}) {
  const [catalog, setCatalog] = useState(catalogDefaults);
  const [typeDetails, setTypeDetails] = useState(defaultTypeDetails);

  const currentTypeOptions = typeOptionsFor(form.giro, typeDetails);

  useEffect(() => {
    if (!activeWorkspace?.id || hydratedWorkspaceId !== activeWorkspace.id) return;
    StorageEngine.saveCatalog(catalog);
  }, [activeWorkspace?.id, catalog, hydratedWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspace?.id || hydratedWorkspaceId !== activeWorkspace.id) return;
    StorageEngine.saveTypeDetails(typeDetails);
  }, [activeWorkspace?.id, hydratedWorkspaceId, typeDetails]);

  function addTypeDetail() {
    setTypeDetails((items) => [
      ...items,
      {
        id: `tipo-${Date.now()}`,
        giro: form.giro,
        tipo: form.giro === 'Vidriería' ? 'Nuevo tipo de vidrio' : 'Nuevo tipo de mueble',
        descripcion: 'Describe cuándo se usa este tipo.',
      },
    ]);
  }

  function updateTypeDetail(id, field, value) {
    setTypeDetails((items) => items.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  }

  function removeTypeDetail(id) {
    setTypeDetails((items) => items.filter((item) => item.id !== id));
  }

  function updateCatalogItem(id, field, value) {
    setCatalog((items) => items.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  }

  function addCatalogItem() {
    setCatalog((items) => [
      ...items,
      normalizeCatalogItem({
        id: `cat-${Date.now()}`,
        categoria: form.giro,
        tipoTrabajo: form.tipoTrabajo,
        nombre: form.producto || 'Nuevo producto',
        materialCotizacion: form.materialCotizacion,
        herrajes: form.herrajes,
        unidad: 'm²',
        costo: numberValue(form.costoMaterialM2),
        precio: numberValue(form.precioM2),
        costoHerrajes: numberValue(form.costoHerrajes),
        precioHerrajes: numberValue(form.precioHerrajes),
        merma: numberValue(form.merma),
        manoObra: numberValue(form.manoObra),
        extras: numberValue(form.extras),
      }),
    ]);
  }

  function removeCatalogItem(id) {
    setCatalog((items) => items.filter((item) => item.id !== id));
  }

  function applyCatalogItem(item) {
    const next = {
      ...form,
      giro: item.categoria || form.giro,
      tipoTrabajo: item.tipoTrabajo || form.tipoTrabajo,
      producto: item.nombre || form.producto,
      materialCotizacion: item.materialCotizacion || form.materialCotizacion,
      herrajes: item.herrajes || form.herrajes,
      costoMaterialM2: numberValue(item.costo),
      precioM2: numberValue(item.precio),
      costoHerrajes: numberValue(item.costoHerrajes),
      precioHerrajes: numberValue(item.precioHerrajes),
      merma: numberValue(item.merma),
      manoObra: numberValue(item.manoObra),
      extras: numberValue(item.extras),
    };

    setForm({
      ...next,
      medidas: formatDimensions(next),
    });
    setActiveSection('cotizador');
  }

  return {
    catalog,
    setCatalog,
    typeDetails,
    setTypeDetails,
    currentTypeOptions,
    addTypeDetail,
    updateTypeDetail,
    removeTypeDetail,
    updateCatalogItem,
    addCatalogItem,
    removeCatalogItem,
    applyCatalogItem,
  };
}
