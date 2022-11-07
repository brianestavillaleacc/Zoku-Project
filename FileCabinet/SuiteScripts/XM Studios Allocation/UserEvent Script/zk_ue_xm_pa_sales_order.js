/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/currentRecord', 'N/record','N/ui/serverWidget'],
    /**
     * @param{currentRecord} currentRecord
     * @param{record} record
     * * @param{serverWidget} serverWidget
     */
    (currentRecord, record,serverWidget) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {

            var properties = scriptContext.request.parameters;
            propertiesResult = properties.hasOwnProperty("productAllocation");
            if (propertiesResult === true){
                if (scriptContext.type === scriptContext.UserEventType.CREATE) {
                    let httpRequests = scriptContext.request;
                    let newRecord = scriptContext.newRecord;
                    let entityProductAllocation = httpRequests.parameters['entity'];
                    let idProductAllocation = httpRequests.parameters['productAllocation'];

                    var disableCustomerField = scriptContext.form.getField({
                        id: 'entity',
                    });

                    disableCustomerField.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.DISABLED
                    });

                        newRecord.setValue({
                            fieldId: 'custbody_zk_so_product_allocation',
                            value: idProductAllocation,
                        });
                }
            }
        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
