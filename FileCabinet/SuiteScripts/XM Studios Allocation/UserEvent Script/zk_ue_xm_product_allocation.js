/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 */

/*
ID        		    : customscript_zk_ue_xm_product_allocation
Name                : Production Allocation
Purpose             : Product Allocation add functionality
Created On          : September 21,2021
Author              : Ceana Technology
Script Type         : User Event Script
Saved Searches      : NONE
*/

define(['N/ui/serverWidget', '../Library/zk_xm_library', 'N/search', 'N/record', 'N/task'], function (serverWidget, libHelper, search, record, task) {

        function form_button(fetchContext) {
            var currentForm = fetchContext.form;
            var currentRecord = fetchContext.newRecord;
            var getInventoryStatusChangeStatus = currentRecord.getValue({
                fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.INVENTORY_STATUS_CHANGE
            });
            var getProductAllocationStatus = currentRecord.getValue({
                fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.STATUS
            });
            var intItemId = currentRecord.getValue({
                fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.ITEM
            });
            var intProductAllocId = currentRecord.id;

            if (fetchContext.type === fetchContext.UserEventType.VIEW) {
                var request = fetchContext.request;

                currentForm.removeButton('_back');
                if (request.parameters.triggeredFromDashboard != null) {
                    if (currentRecord.getValue(libHelper.PRODUCT_ALLOCATION_RECORD.STATUS) == libHelper.allocationStatus.CANCELLED) {

                        currentForm.addButton({
                            id: 'custpage_go_to_dashboard',
                            label: 'Dashboard',
                            functionName: 'redirectDashboard'
                        });
                    } else if(!currentRecord.getValue(libHelper.PRODUCT_ALLOCATION_RECORD.ORDERED_QTY)){
                        var html = "";
                        var fieldHTML = currentForm.addField({
                            id: 'custpage_html',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Text'
                        });
                        html += "<script>";
                        html += "document.getElementById('_back').removeAttribute('onclick');";
                        html += "document.getElementById('_back').setAttribute('onclick','window.location.href = " + '"/app/site/hosting/scriptlet.nl?script=421&deploy=1&compid=6961610-sb1&whence="' + ";');";
                        html += "</script>";
                        fieldHTML.defaultValue = html;
                    }

                } else {

                    currentForm.addButton({
                        id: 'custpage_go_to_dashboard',
                        label: 'Dashboard',
                        functionName: 'redirectDashboard'
                    });
                }

                if (getProductAllocationStatus !== libHelper.allocationStatus.CANCELLED) {
                    currentForm.addButton({
                        id: 'custpage_acknowledge_cancel',
                        label: 'Cancel Product Allocation',
                        functionName: 'cancelProductAllocation'
                    });

                    var lookupFieldCustomer = search.lookupFields({
                        type: search.Type.CUSTOMER,
                        id: currentRecord.getValue({ fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.DISTRIBUTOR }),
                        columns: ['custentity_xm_custinternaldistributor']
                    });

                    if(!lookupFieldCustomer.custentity_xm_custinternaldistributor) {
                        if(checkSalesOrders(intProductAllocId) && !currentRecord.getValue("custrecord_zk_pa_leftovers")) {
                            currentForm.removeButton('edit');
                        }
                    }

                    if (getProductAllocationStatus == libHelper.allocationStatus.ACKNOWLEDGE) {
                        currentForm.addButton({
                            id: 'custpage_add_quantity',
                            label: 'Additional Quantity',
                            functionName: 'showDialogBox(' + intItemId + ')'
                        });

                        var objItemDetails = getItemDetails(intItemId);
                        var objProductAllocations = getProductAllocations(intItemId);
                        var intRemainderQuantity = calculateRemainder(objItemDetails, objProductAllocations);
                        var stHtml = "";
                        var fieldHTML = currentForm.addField({
                            id: 'custpage_html2',
                            type: serverWidget.FieldType.INLINEHTML,
                            label: 'Text'
                        });
                        stHtml += "<script>";
                        stHtml += 'jQuery("#custpage_add_quantity").removeAttribute("onclick")';
                        stHtml += 'jQuery(document).ready(function(){ jQuery("#custpage_add_quantity").click(function(e){ e.preventDefault();';
                        stHtml += 'setTimeout(function() {';
                        stHtml += 'var fldRemainder=jQuery("#custpage_remainder");';
                        stHtml += 'fldRemainder.prop( "disabled", true );';
                        stHtml += 'jQuery("#custpage_inputdialog").keyup(function(){jQuery(this).val(jQuery(this).val().match(/\\d*\\.?\\d+/));';
                        stHtml += 'if(parseInt(jQuery(this).val()) > ' + parseInt(intRemainderQuantity) + '){alert("Not Enough Available Quantity");jQuery(this).val("'+intRemainderQuantity+'");}';
                        stHtml += 'else if (parseInt(jQuery(this).val()) < 1) {alert(\'Value cannot be lower than 1\');jQuery(this).val(\'\');}';
                        stHtml += '});';
                        stHtml += 'jQuery("#btnSubmitOk").on("click",function(e){ e.stopPropagation(); try { ';
                        stHtml += 'var stAdditionalQuantity = jQuery("#custpage_inputdialog").val();';
                        stHtml += 'if(stAdditionalQuantity) {';
                        stHtml += ' window.require(["N/url","N/https"],function (url,https) {';
                        stHtml += 'var inType = window.nlapiGetRecordType();';
                        stHtml += 'var inId = window.nlapiGetRecordId();';
                        stHtml += 'var output = url.resolveScript({';
                        stHtml += 'scriptId: "customscript_zk_sl_xm_add_allocation",';
                        stHtml += 'deploymentId: "customdeploy_zk_sl_xm_add_allocation",';
                        stHtml += ' params : {sltype : "process",rec_id : inId,rec_type : inType,additional : stAdditionalQuantity}});';
                        stHtml += 'var response =  https.get(output);';
                        stHtml += 'if(response.code === 200){window.location.reload();} });';
                        stHtml += '}else{ alert("Value cannot be empty.") }';
                        stHtml += '} catch (e) { console.log(e); } });';
                        stHtml += 'jQuery("#btnSubmitCancel").on("click",function(e){ window.location.reload(); });';
                        stHtml += "(function ($) {$(function ($, undefined) {$('.uir-message-buttons').last().hide();})})(jQuery); }, 1000);";
                        stHtml += "setWindowChanged(window, false);;history.back(); return false; }); });";
                        stHtml += "</script>";
                        fieldHTML.defaultValue = stHtml;

                    }

                    // if ((getInventoryStatusChangeStatus === "") && (getProductAllocationStatus === libHelper.allocationStatus.PENDING)) {
                    //     currentForm.addButton({
                    //         id: 'custpage_create_inventory_status_change',
                    //         label: 'Create Inventory Status Change',
                    //         functionName: 'createInventoryStatusChange'
                    //     });
                    // } else {
                    if (getProductAllocationStatus !== libHelper.allocationStatus.ACKNOWLEDGE) {
                        currentForm.addButton({
                            id: 'custpage_acknowledge',
                            label: 'Acknowledge',
                            functionName: 'changeAcknowledgeStatus'
                        });

                        // var htmlAcknowledge = "";
                        // var fieldHTMLAcknowledge = currentForm.addField({
                        //     id : 'custpage_html1',
                        //     type : serverWidget.FieldType.INLINEHTML,
                        //     label : 'Text'
                        // });
                        // htmlAcknowledge += "<script>";
                        // htmlAcknowledge += "var stFunction = 'document.getElementById('custpage_acknowledge').disabled = true;'";
                        // htmlAcknowledge += "stFunction += document.getElementById('custpage_acknowledge').getAttribute('onclick');";
                        // htmlAcknowledge += "document.getElementById('custpage_acknowledge').removeAttribute('onclick');";
                        // // htmlAcknowledge += "document.getElementById('custpage_acknowledge').setAttribute('onclick',stFunction);";
                        // htmlAcknowledge += "</script>";
                        // fieldHTMLAcknowledge.defaultValue = html;
                    }
                    // }
                } else {
                    currentForm.removeButton('edit');
                }
                currentForm.clientScriptModulePath = 'SuiteScripts/XM Studios Allocation/Client Script/zk_cs_xm_product_allocation.js';
            }
        }

        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        function beforeLoad(scriptContext) {

            if (scriptContext.type == "create") {
                throw "Not Allowed to create Product Allocation in this page. Go to Dashboard page.";
            }
            try {
                var newRecord = scriptContext.newRecord;
                form_button(scriptContext);
            } catch (err) {
                log.debug(err);
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
        function beforeSubmit(scriptContext) {

            var newRecord = scriptContext.newRecord;
            var flLeftOver = parseFloat(newRecord.getValue("custrecord_zk_pa_leftovers") || 0);
            var flOrderedQty = parseFloat(newRecord.getValue("custrecord_zk_pa_ordered_quantity") || 0);
            newRecord.setValue("custrecord_zk_pa_allocated_quantity", parseFloat(flLeftOver+flOrderedQty))

            if (newRecord.getValue({fieldId: "custrecord_zk_pa_to_process_so"})) {
                var objProductAllocation = getProductAllocationDetails(newRecord.id);
                if(!objProductAllocation.isinternaldistributor) {
                    var intSalesOrder = createSalesOrder(objProductAllocation, newRecord.id);
                    if (intSalesOrder) {
                        newRecord.setValue({
                            fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.SALES_ORDER,
                            value: intSalesOrder
                        });
                        newRecord.setValue({
                            fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.STATUS,
                            value: libHelper.allocationStatus.ACKNOWLEDGE
                        });
                        newRecord.setValue({fieldId: "custrecord_zk_pa_to_process_so", value: false});
                    }
                } else {
                    newRecord.setValue({ fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.STATUS, value: libHelper.allocationStatus.ACKNOWLEDGE });
                    newRecord.setValue({fieldId: "custrecord_zk_pa_to_process_so", value: false});
                    updateEstimatedManufacturedQuantityFromClientScript(objProductAllocation.custrecord_zk_pa_item, objProductAllocation.custrecord_zk_pa_leftovers, "acknowledge");
                }
            }
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        function afterSubmit(scriptContext) {
            try {
                var newRecord = scriptContext.newRecord;
                var oldRecord = scriptContext.oldRecord;

                var intOrderedQty = oldRecord.getValue({fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.ORDERED_QTY});
                var intItemId = oldRecord.getValue({fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.ITEM});
                var stNewStatus = newRecord.getValue({fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.STATUS});
                var stOldStatus = oldRecord.getValue({fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.STATUS});

                if (stNewStatus == libHelper.allocationStatus.CANCELLED && stOldStatus != stNewStatus) {
                    if(intOrderedQty) {
                        // updateEstimatedManufacturedQuantityFromClientScript(intItemId, intOrderedQty, stNewStatus);
                    }
                }

                if(stNewStatus == libHelper.allocationStatus.CANCELLED && newRecord.getValue(libHelper.PRODUCT_ALLOCATION_RECORD.TO_PROCESS_CANCELLATION)) {
                    var scriptTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: "customscript_zk_mr_xm_close_so_pa",
                        deploymentId: "customdeploy_zk_mr_xm_close_so_pa",
                        params:{ custscript_zk_xm_pa_id: newRecord.id }
                    }).submit();

                    log.debug('scriptTask', scriptTask);

                    record.submitFields({
                        type: newRecord.type,
                        id: newRecord.id,
                        values: { custrecord_zk_pa_process_pa_cancellation: false }
                    });

                }

            } catch (error) {
                log.error("afterSubmit ERROR:",error)
            }

            /*
            // if(newRecord.getValue({fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.INVENTORY_STATUS_CHANGE})) {
            //     record.submitFields({
            //         type: 'customrecord_zk_product_allocation',
            //         id: newRecord.id,
            //         values: {
            //             custrecord_zk_pa_process_isc: false
            //         }
            //     });
            // }

            if (newRecord.getValue({fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.SALES_ORDER})) {
                var flOldAllocationQuantity = oldRecord.getValue(libHelper.PRODUCT_ALLOCATION_RECORD.ALLOCATED_QTY);
                var flNewAllocationQuantity = newRecord.getValue(libHelper.PRODUCT_ALLOCATION_RECORD.ALLOCATED_QTY);
                if (flNewAllocationQuantity && flOldAllocationQuantity) {
                    if (flOldAllocationQuantity != flNewAllocationQuantity) {
                        var recSalesOrder = record.load({
                            type: "salesorder",
                            id: newRecord.getValue(libHelper.PRODUCT_ALLOCATION_RECORD.SALES_ORDER),
                            isDynamic: true
                        });
                        var lookupFieldItem = search.lookupFields({
                            type: search.Type.ITEM,
                            id: recSalesOrder.getSublistValue({sublistId: "item", fieldId: "item", line: 1}),
                            columns: ['custitem_zk_deposit_amount']
                        });

                        var currLine = recSalesOrder.selectLine({sublistId: 'item', line: 1});
                        var flOriginalRate = currLine.getCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_original_rate"
                        });
                        var flDiscount = currLine.getCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_discount_percent"
                        }) || 0;
                        var flDiscountAmount = flOriginalRate * parseFloat(flDiscount / 100);
                        var flDiscountedRate = flOriginalRate - flDiscountAmount;

                        currLine.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_discount_amount",
                            value: flDiscountAmount
                        });
                        currLine.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: flNewAllocationQuantity
                        });
                        currLine.setCurrentSublistValue({sublistId: "item", fieldId: "rate", value: flDiscountedRate});
                        currLine.commitLine({sublistId: 'item'});

                        var flDepositAmount = (lookupFieldItem.custitem_zk_deposit_amount) ? lookupFieldItem.custitem_zk_deposit_amount : 0;
                        var flAdvanceDepositRate = (flDiscountedRate < flDepositAmount) ? flDiscountedRate : flDepositAmount;

                        var currLine = recSalesOrder.selectLine({sublistId: 'item', line: 0});
                        currLine.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: flAdvanceDepositRate
                        });
                        currLine.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_original_rate",
                            value: flAdvanceDepositRate
                        });
                        currLine.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: flNewAllocationQuantity
                        });
                        currLine.commitLine({sublistId: 'item'});

                        var currLine = recSalesOrder.selectLine({sublistId: 'item', line: 2});
                        currLine.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "rate",
                            value: flAdvanceDepositRate * -1
                        });
                        currLine.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "custcol_original_rate",
                            value: flAdvanceDepositRate * -1
                        });
                        currLine.setCurrentSublistValue({
                            sublistId: "item",
                            fieldId: "quantity",
                            value: flNewAllocationQuantity
                        });
                        currLine.commitLine({sublistId: 'item'});

                        recSalesOrder.save();
                        updateEstimatedManufacturedQuantity(scriptContext);
                    }
                }
            }*/

        }

        function createSalesOrder(objProductAllocation, intProductAllocationId) {
            try{
                var intCustomerCategory = (objProductAllocation.category) ? objProductAllocation.category : "";
                var intPricingGroup = (objProductAllocation.pricinggroup) ? objProductAllocation.pricinggroup : "";
                var fetchItemRate = getItemPrice(objProductAllocation);

                log.debug("fetchItemRate", fetchItemRate);

                var flDepositAmount = (objProductAllocation.depositamount) ? objProductAllocation.depositamount : 0;
                var flDiscount = parseFloat(getCustomerDiscountPercent(intCustomerCategory, intPricingGroup));
                var flDiscountAmount = fetchItemRate * parseFloat(flDiscount / 100);
                var flDiscountedRate = fetchItemRate - flDiscountAmount;
                var flAdvanceDepositRate = (flDiscountedRate < flDepositAmount) ? flDiscountedRate : flDepositAmount;

                log.debug("flAdvanceDepositRate", flAdvanceDepositRate);

                var lookupFieldCustomer = search.lookupFields({
                    type: search.Type.CUSTOMER,
                    id: objProductAllocation.custrecord_zk_pa_distributor,
                    columns: ['subsidiary']
                });
                var intSubsidiary = (lookupFieldCustomer.subsidiary.length != 0) ? lookupFieldCustomer.subsidiary[0].value : 1;
                var createSalesOrder = record.create({
                    type: 'salesorder',
                    defaultValues: {entity: objProductAllocation.custrecord_zk_pa_distributor, subsidiary: intSubsidiary}
                });

                createSalesOrder.setValue({fieldId: 'tobeemailed', value: false});
                createSalesOrder.setValue({fieldId: 'trandate', value: new Date()});
                createSalesOrder.setValue({fieldId: 'location', value: objProductAllocation.custrecord_zk_pa_location});
                //code: 0001
                //createSalesOrder.setValue({fieldId: 'custbody_zk_so_product_allocation', value: intProductAllocationId});

                var currentLine = createSalesOrder.insertLine({sublistId: 'item', line: 0});
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: 0,
                    value: objProductAllocation.advanceitem
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'department',
                    line: 0,
                    value: objProductAllocation.department
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'class',
                    line: 0,
                    value: objProductAllocation.class
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'location',
                    line: 0,
                    value: objProductAllocation.custrecord_zk_pa_location
                });
                // currentLine.setSublistValue({ sublistId: 'item', fieldId: 'price', line: 0, value: objProductAllocation.pricelevel });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: 0,
                    value: parseFloat(objProductAllocation.custrecord_zk_pa_leftovers).toFixed(2)
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_original_rate',
                    line: 0,
                    value: flAdvanceDepositRate
                });
                currentLine.setSublistValue({sublistId: 'item', fieldId: 'rate', line: 0, value: flAdvanceDepositRate});

                var currentLine = createSalesOrder.insertLine({sublistId: 'item', line: 1});
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: 1,
                    value: objProductAllocation.custrecord_zk_pa_item
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'department',
                    line: 1,
                    value: objProductAllocation.department
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'class',
                    line: 1,
                    value: objProductAllocation.class
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'location',
                    line: 1,
                    value: objProductAllocation.custrecord_zk_pa_location
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'price',
                    line: 1,
                    value: objProductAllocation.pricelevel
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: 1,
                    value: parseFloat(objProductAllocation.custrecord_zk_pa_leftovers).toFixed(2)
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_original_rate',
                    line: 1,
                    value: fetchItemRate
                });
                currentLine.setSublistValue({sublistId: 'item', fieldId: 'rate', line: 1, value: flDiscountedRate});
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_discount_percent',
                    line: 1,
                    value: flDiscount
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_discount_amount',
                    line: 1,
                    value: flDiscountAmount * parseFloat(objProductAllocation.custrecord_zk_pa_leftovers)
                });

                //code 0001
                currentLine.setSublistValue({sublistId: 'item', fieldId: 'custcol_zoku_product_allocation', line: 1, value: intProductAllocationId});

                var currentLine = createSalesOrder.insertLine({sublistId: 'item', line: 2});
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'item',
                    line: 2,
                    value: objProductAllocation.advanceitem
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'department',
                    line: 2,
                    value: objProductAllocation.department
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'class',
                    line: 2,
                    value: objProductAllocation.class
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'location',
                    line: 2,
                    value: objProductAllocation.custrecord_zk_pa_location
                });
                // currentLine.setSublistValue({ sublistId: 'item', fieldId: 'price', line: 2, value: objProductAllocation.pricelevel });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: 2,
                    value: parseFloat(parseFloat(objProductAllocation.custrecord_zk_pa_leftovers) * -1).toFixed(2)
                });
                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_original_rate',
                    line: 2,
                    value: flAdvanceDepositRate
                });

                currentLine.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'rate',
                    line: 2,
                    value: flAdvanceDepositRate
                });

                var idSalesOrder = createSalesOrder.save();

                if (idSalesOrder) {
                    updateEstimatedManufacturedQuantityFromClientScript(objProductAllocation.custrecord_zk_pa_item, objProductAllocation.custrecord_zk_pa_leftovers, "acknowledge");
                }

                return idSalesOrder;
            }catch(objError) {
                log.error('Error catched', objError)
            }

        }

        function getProductAllocationDetails(intProductAllocation) {
            var objData = {};
            var customrecord_zk_product_allocationSearchObj = search.create({
                type: "customrecord_zk_product_allocation",
                filters: ["internalid", "is", intProductAllocation],
                columns: [
                    search.createColumn({name: "name"}),
                    search.createColumn({name: "custrecord_zk_pa_distributor"}),
                    search.createColumn({name: "custrecord_zk_pa_allocated_quantity"}),
                    search.createColumn({name: "custrecord_zk_pa_leftovers"}),
                    search.createColumn({name: "custrecord_zk_pa_status"}),
                    search.createColumn({name: "custrecord_zk_pa_item"}),
                    search.createColumn({name: "custrecord_zk_pa_salesorder"}),
                    search.createColumn({name: "custrecord_zk_pa_location"}),
                    search.createColumn({name: "department", join: "CUSTRECORD_ZK_PA_ITEM"}),
                    search.createColumn({name: "custitem_zk_advance_item", join: "CUSTRECORD_ZK_PA_ITEM"}),
                    search.createColumn({name: "custitem_zk_deposit_amount", join: "CUSTRECORD_ZK_PA_ITEM"}),
                    search.createColumn({name: "class", join: "CUSTRECORD_ZK_PA_ITEM"}),
                    search.createColumn({name: "pricinggroup", join: "CUSTRECORD_ZK_PA_ITEM"}),
                    search.createColumn({name: "currency", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
                    search.createColumn({name: "pricelevel", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
                    search.createColumn({name: "category", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
                    search.createColumn({name: "custentity_xm_custinternaldistributor", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"})
                ]
            });
            var searchResultCount = customrecord_zk_product_allocationSearchObj.runPaged().count;
            if (searchResultCount.length != 0) {
                customrecord_zk_product_allocationSearchObj.run().each(function (result) {
                    objData = {
                        tranid: result.getValue({name: "name"}),
                        custrecord_zk_pa_distributor: result.getValue({name: "custrecord_zk_pa_distributor"}),
                        custrecord_zk_pa_allocated_quantity: result.getValue({name: "custrecord_zk_pa_allocated_quantity"}),
                        custrecord_zk_pa_leftovers: result.getValue({name: "custrecord_zk_pa_leftovers"}),
                        custrecord_zk_pa_status: result.getValue({name: "custrecord_zk_pa_status"}),
                        custrecord_zk_pa_item: result.getValue({name: "custrecord_zk_pa_item"}),
                        custrecord_zk_pa_item_text: result.getText({name: "custrecord_zk_pa_item"}),
                        custrecord_zk_pa_salesorder: result.getValue({name: "custrecord_zk_pa_salesorder"}),
                        custrecord_zk_pa_location: result.getValue({name: "custrecord_zk_pa_location"}),
                        advanceitem: result.getValue({
                            name: "custitem_zk_advance_item",
                            join: "CUSTRECORD_ZK_PA_ITEM"
                        }) || "846",
                        depositamount: result.getValue({
                            name: "custitem_zk_deposit_amount",
                            join: "CUSTRECORD_ZK_PA_ITEM"
                        }),
                        department: result.getValue({name: "department", join: "CUSTRECORD_ZK_PA_ITEM"}),
                        class: result.getValue({name: "class", join: "CUSTRECORD_ZK_PA_ITEM"}),
                        pricinggroup: result.getValue({name: "pricinggroup", join: "CUSTRECORD_ZK_PA_ITEM"}),
                        currency: result.getValue({name: "currency", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
                        pricelevel: result.getValue({name: "pricelevel", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
                        category: result.getValue({name: "category", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"}),
                        isinternaldistributor: result.getValue({name: "custentity_xm_custinternaldistributor", join: "CUSTRECORD_ZK_PA_DISTRIBUTOR"})
                    };
                    return false;
                });
            }
            return objData;
        }

        function getCustomerDiscountPercent(intCustomerCategory, intPricingGroup) {
            var discountPercent = 0;
            if (!intCustomerCategory || !intPricingGroup) return discountPercent;

            var discountSearchObj = search.create({
                type: "customrecord_customer_discounting",
                filters: [
                    ["isinactive", "is", "F"], "AND",
                    ["custrecord_zk_cd_customer_category", "is", intCustomerCategory], "AND",
                    ["custrecord_zk_cd_pricing_grioup", "is", intPricingGroup]
                ],
                columns: [search.createColumn({name: "custrecord_zk_cd_discount_percent"})]
            });
            var searchResultCount = discountSearchObj.runPaged().count;
            if (searchResultCount != 0) {
                discountSearchObj.run().each(function (result) {
                    discountPercent = result.getValue({name: "custrecord_zk_cd_discount_percent"})
                    return true;
                });
            }
            return discountPercent;
        }

        function getItemPrice(objProductAllocation) {
            var flLineItemRate = 0;
            var defaultPriceLevel = '1'; //Base Price
            if(objProductAllocation.pricelevel) {
                defaultPriceLevel = objProductAllocation.pricelevel;
            }

            var searchPricingObj = search.create({
                type: 'pricing',
                filters: [
                    ['item', search.Operator.IS, objProductAllocation.custrecord_zk_pa_item], 'and',
                    ['currency', search.Operator.IS, objProductAllocation.currency], 'and',
                    ['pricelevel', search.Operator.IS, defaultPriceLevel]
                ],
                columns: [
                    search.createColumn({name: "minimumquantity", sort: search.Sort.ASC}),
                    search.createColumn({name: "unitprice"}),
                    search.createColumn({name: "quantityrange"}),
                ]
            });

            var searchResultCount = searchPricingObj.runPaged().count;
            if (searchResultCount != 0) {
                var currentRange = searchPricingObj.run().getRange({start: 0, end: 5});
                for (var intIndex = 0; intIndex < currentRange.length; intIndex++) {
                    var arrQtyRange = currentRange[intIndex].getValue('quantityrange').split("-");
                    var intLimit = arrQtyRange[1];
                    if (arrQtyRange.length == 2) {
                        if (parseFloat(objProductAllocation.custrecord_zk_pa_allocated_quantity) <= parseFloat(intLimit)) {
                            flLineItemRate = currentRange[intIndex].getValue('unitprice');
                            break;
                        }
                    } else if (arrQtyRange.length == 1) {
                        flLineItemRate = currentRange[intIndex].getValue('unitprice');
                    }
                }
            }

            return flLineItemRate;
        }

        function getAvailableInventoryNumbers(context) {
            var newRecord = context.newRecord;
            var arrData = [];
            var inventoryNumberSearchObj = search.create({
                type: 'inventorynumber',
                filters: [
                    ["item", search.Operator.IS, newRecord.getValue('custrecord_zk_pa_item')], "and",
                    ["quantityavailable", search.Operator.GREATERTHANOREQUALTO, "1"], "and",
                    ["location", search.Operator.IS, newRecord.getValue('custrecord_zk_pa_location')]
                ],
                columns: [
                    search.createColumn({
                        name: "inventorynumber",
                        sort: search.Sort.ASC,
                        label: "Number"
                    }),
                    search.createColumn({
                        name: "item",
                        label: "Item"
                    }),
                    search.createColumn({
                        name: "location",
                        label: "Location"
                    }),
                    search.createColumn({
                        name: "quantityavailable",
                        label: "Available"
                    }),

                ]
            });

            var resultSet = inventoryNumberSearchObj.run();
            var objSearchResult = resultSet.getRange({
                start: 0,
                end: newRecord.getValue('custrecord_zk_pa_allocated_quantity')
            });

            if (objSearchResult.length != 0) {
                for (var inventoryIndex = 0; inventoryIndex < objSearchResult.length; inventoryIndex++) {
                    arrData.push(objSearchResult[inventoryIndex].id);
                }
            }
            return arrData;
        }

        function createInventoryStatusChange(context) {
            var newRecord = context.newRecord;
            var recInventoryStatusChange = record.create({type: 'inventorystatuschange', isDynamic: true});
            recInventoryStatusChange.setValue({
                fieldId: 'location',
                value: newRecord.getValue('custrecord_zk_pa_location')
            });
            recInventoryStatusChange.setValue({fieldId: 'trandate', value: new Date()});
            recInventoryStatusChange.setValue({fieldId: 'previousstatus', value: '1'});
            recInventoryStatusChange.setValue({fieldId: 'revisedstatus', value: '2'});

            var currentLine = recInventoryStatusChange.selectNewLine({sublistId: 'inventory'});
            currentLine.setCurrentSublistValue({
                sublistId: 'inventory',
                fieldId: 'item',
                value: newRecord.getValue('custrecord_zk_pa_item')
            });
            currentLine.setCurrentSublistValue({
                sublistId: 'inventory',
                fieldId: 'quantity',
                value: newRecord.getValue('custrecord_zk_pa_allocated_quantity')
            });

            var itemLookupField = search.lookupFields({
                type: search.Type.ITEM,
                id: newRecord.getValue({fieldId: libHelper.PRODUCT_ALLOCATION_RECORD.ITEM}),
                columns: ['isserialitem', 'islotitem']
            });

            if (itemLookupField.isserialitem === true || itemLookupField.islotitem === true) {
                var inventoryDetailRecord = currentLine.getCurrentSublistSubrecord({
                    sublistId: 'inventory',
                    fieldId: 'inventorydetail'
                });
                var arrAvailableInventoryNumbers = getAvailableInventoryNumbers(context);
                if (arrAvailableInventoryNumbers.length != 0) {
                    for (var intIndex = 0; intIndex < arrAvailableInventoryNumbers.length; intIndex++) {
                        inventoryDetailRecord.selectNewLine({sublistId: 'inventoryassignment'});
                        inventoryDetailRecord.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'issueinventorynumber',
                            value: arrAvailableInventoryNumbers[intIndex]
                        });
                        inventoryDetailRecord.setCurrentSublistValue({
                            sublistId: 'inventoryassignment',
                            fieldId: 'quantity',
                            value: 1
                        });
                        inventoryDetailRecord.commitLine({sublistId: 'inventoryassignment'});
                    }
                }
            }

            currentLine.commitLine({sublistId: 'inventory'});
            var recInventoryStatusChangeId = recInventoryStatusChange.save();

            /** Update Product Allocation Tagging **/
            newRecord.setValue({fieldId: "custrecord_zk_pa_inventorystatuschange", value: recInventoryStatusChangeId});
        }

        function updateEstimatedManufacturedQuantity(context) {
            var newRecord = context.newRecord;
            var oldRecord = context.oldRecord;

            var flOldAllocationQuantity = oldRecord.getValue(libHelper.PRODUCT_ALLOCATION_RECORD.ALLOCATED_QTY);
            var flNewAllocationQuantity = newRecord.getValue(libHelper.PRODUCT_ALLOCATION_RECORD.ALLOCATED_QTY);
            var arrItemTypes = {
                "Description": "descriptionitem",
                "Discount": "discountitem",
                "InvtPart": "inventoryitem",
                "Kit": "kititem",
                "Markup": "markupitem",
                "NonInvtPart": "noninventoryitem",
                "OthCharge": "otherchargeitem",
                "Payment": "paymentitem",
                "Service": "serviceitem"
            };
            var lookupFieldItem = search.lookupFields({
                type: search.Type.ITEM,
                id: newRecord.getValue(libHelper.PRODUCT_ALLOCATION_RECORD.ITEM),
                columns: ['custitem_zk_available_manufacture_qty', 'type', 'isserialitem', 'islotitem']
            });
            var stItemType = arrItemTypes[lookupFieldItem.type[0].value];
            if (lookupFieldItem.isserialitem) {
                stItemType = "serializedinventoryitem";
            }
            if (lookupFieldItem.islotitem) {
                stItemType = "lotnumberedinventoryitem";
            }

            var flRemaningQuantity = 0;
            var flEstimatedQuantity = lookupFieldItem.custitem_zk_available_manufacture_qty || 0;

            if (flNewAllocationQuantity > flOldAllocationQuantity) {
                var flExcessQuantity = parseFloat(flNewAllocationQuantity) - parseFloat(flOldAllocationQuantity);
                flRemaningQuantity = parseFloat(flEstimatedQuantity) - flExcessQuantity;
            } else {
                var flToBeReturnedQuantity = parseFloat(flOldAllocationQuantity) - parseFloat(flNewAllocationQuantity);
                flRemaningQuantity = parseFloat(flEstimatedQuantity) + flToBeReturnedQuantity;
            }

            record.submitFields({
                type: stItemType,
                id: newRecord.getValue(libHelper.PRODUCT_ALLOCATION_RECORD.ITEM),
                values: {custitem_zk_available_manufacture_qty: flRemaningQuantity}
            });
        }

        function updateEstimatedManufacturedQuantityFromClientScript(intItemId, flQuantity, executionType) {
            var arrItemTypes = {
                "Description": "descriptionitem",
                "Discount": "discountitem",
                "InvtPart": "inventoryitem",
                "Kit": "kititem",
                "Markup": "markupitem",
                "NonInvtPart": "noninventoryitem",
                "OthCharge": "otherchargeitem",
                "Payment": "paymentitem",
                "Service": "serviceitem"
            };
            var lookupFieldItem = search.lookupFields({
                type: search.Type.ITEM,
                id: intItemId,
                columns: ['custitem_zk_available_manufacture_qty', 'type', 'isserialitem', 'islotitem']
            });
            var stItemType = arrItemTypes[lookupFieldItem.type[0].value];
            if (lookupFieldItem.isserialitem) {
                stItemType = "serializedinventoryitem";
            }
            if (lookupFieldItem.islotitem) {
                stItemType = "lotnumberedinventoryitem";
            }

            var flRemaningQuantity = 0;
            var flEstimatedQuantity = lookupFieldItem.custitem_zk_available_manufacture_qty || 0;

            if (executionType == "acknowledge") {
                //Acknowledge
                flRemaningQuantity = parseFloat(flEstimatedQuantity) - parseFloat(flQuantity);
            } else {
                // Cancel/Delete Product Allocation
                flRemaningQuantity = parseFloat(flEstimatedQuantity) + parseFloat(flQuantity);
            }

            record.submitFields({
                type: stItemType,
                id: intItemId,
                values: {custitem_zk_available_manufacture_qty: flRemaningQuantity}
            });
        }

        function calculateRemainder(objItemDetails, objProductAllocations) {
            var flTotalAllocated = 0;
            var flTotalDeductions = 0;
            var intDistributorPool= objItemDetails.custitem_zk_distributor_pool;
            for (var intIndex in objProductAllocations) {
                if (objProductAllocations[intIndex].custrecord_zk_pa_status == "Pending") {
                    flTotalAllocated += parseFloat(objProductAllocations[intIndex].custrecord_zk_pa_leftovers || 0);
                }
                if(objProductAllocations[intIndex].custrecord_zk_pa_status == "Acknowledged" && objProductAllocations[intIndex].isInternalDistributor) {
                    flTotalAllocated += parseFloat(objProductAllocations[intIndex].custrecord_zk_pa_leftovers || 0);
                }
            }
            flTotalDeductions = parseFloat(flTotalAllocated + parseFloat(intDistributorPool));
            return parseFloat(objItemDetails.custitem_zk_available_manufacture_qty - flTotalDeductions);
        }

        function getProductAllocations(intItem) {
            var objData = {};
            if (intItem == "") {
                return objData;
            }
            var filters = [
                ["custrecord_zk_pa_item", "is", intItem], "AND",
                ["custrecord_zk_pa_status", "noneof", "3"]
            ];
            var itemSearchObj = search.create({
                type: "customrecord_zk_product_allocation",
                filters: filters,
                columns: [
                    search.createColumn({name: "custrecord_zk_pa_allocated_quantity"}),
                    search.createColumn({name: "custrecord_zk_pa_status"}),
                    search.createColumn({name: "custrecord_zk_pa_leftovers"}),
                    search.createColumn({name: "custentity_xm_custinternaldistributor", join: "custrecord_zk_pa_distributor" })
                ]
            });
            var searchResultCount = itemSearchObj.runPaged().count;
            if (searchResultCount != 0) {
                itemSearchObj.run().each(function (result) {
                    if (objData[result.id] == null) {
                        objData[result.id] = {};
                    }
                    objData[result.id] = {
                        'custrecord_zk_pa_allocated_quantity': result.getValue('custrecord_zk_pa_allocated_quantity') || 0,
                        'custrecord_zk_pa_status': result.getText('custrecord_zk_pa_status'),
                        'custrecord_zk_pa_leftovers': result.getValue('custrecord_zk_pa_leftovers'),
                        'isInternalDistributor': result.getValue({
                            name: "custentity_xm_custinternaldistributor",
                            join: "custrecord_zk_pa_distributor"
                        })
                    };
                    return true;
                });
            }
            return objData;
        }

        function getItemDetails(intItem) {
            var lookupFieldItem = search.lookupFields({
                type: search.Type.ITEM,
                id: intItem,
                columns: ['custitem_zk_available_manufacture_qty','custitem_zk_distributor_pool']
            });
            return {
                'custitem_zk_distributor_pool': lookupFieldItem['custitem_zk_distributor_pool'] || 0,
                'custitem_zk_available_manufacture_qty':lookupFieldItem['custitem_zk_available_manufacture_qty'] || 0
            };
        }

        /*
        function checkSalesOrders(intProductAlloc) {
            var srSalesOrder = search.create({
                type: "salesorder",
                filters:
                    [
                        ["type", "anyof", "SalesOrd"],
                        "AND",
                        ["custbody_zk_so_product_allocation", "anyof", intProductAlloc],
                        "AND",
                        ["mainline", "is", "T"]
                    ]
            });
            var inSOCount = srSalesOrder.runPaged().count;
            log.debug(intProductAlloc + ":result count", inSOCount);
            return inSOCount > 0;
        }
        */
        function checkSalesOrders(intProductAlloc) {
            var srSalesOrder = search.create({
                type: "salesorder",
                filters:
                    [
                        ["type", "anyof", "SalesOrd"],
                        "AND",
                        ["custcol_zoku_product_allocation", "anyof", intProductAlloc],
                        "AND",
                        ["mainline", "is", "F"]
                    ]
            });
            var inSOCount = srSalesOrder.runPaged().count;
            log.debug(intProductAlloc + ":result count", inSOCount);
            return inSOCount > 0;
        }

        return {
            beforeLoad: beforeLoad,
            beforeSubmit: beforeSubmit,
            afterSubmit: afterSubmit
        }

    }
)
;