/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */

/*
ID        		    : customscript_zk_ss_xm_product_allocation
Name                : Production Allocation
Purpose             : Product Allocation Last Reminder
Created On          : October 4,2021
Author              : Ceana Technology
Script Type         : Scheduled Script
Saved Searches      : NONE
*/

define(['N/email','N/runtime','N/search','N/record'],
    /**
     * @param{search} search
     */
    (email, runtime,search,record) => {

        var markMailSent = function(intProductAllocationId){
            record.submitFields({
                type: 'customrecord_zk_product_allocation',
                id: intProductAllocationId,
                values: {
                    'custrecord_zk_pa_email_last_reminder': true }            
            })
        }

        var arrEmployeeList = function(){

            var currentRuntime = runtime.getCurrentScript();
            var idParamsEmployeeList = currentRuntime.getParameter({name:'custscript_zk_xm_list_employee'});
            var arrData = [];
            var objSearchEmployees = search.load({id: idParamsEmployeeList});
            var searchEmployeesResultCount = objSearchEmployees.runPaged().count;
            if(searchEmployeesResultCount != 0){
            objSearchEmployees.run().each(function(result){
                var employeeInternalID = result.getValue('internalid');
                arrData.push(employeeInternalID);
                return true;
            })
            }
            return arrData;

        }

        var arrSavedSearchReminder = function(){

            var currentRuntime = runtime.getCurrentScript();
            var idSavedSearch = currentRuntime.getParameter({name:'custscript_zk_xm_saved_search'});
            var arrData = [];
            var objSearchReminder = search.load({id: idSavedSearch});
            var searchReminderResultCount = objSearchReminder.runPaged().count;
            if(searchReminderResultCount != 0){
                objSearchReminder.run().each(function(result){
                    var objData = {};
                    objData['idProductAllocation'] = result.getValue('internalid');
                    arrData.push(objData);
                    return true;
                })
               }
               return arrData;
            }

        var sendEmail = function(){

                var body = "";
                body += '<div class="row">';
                body += '  <div class="col-md-12" style="text-align:center; padding-top: 20px;">';
                body += '  <p style="font-size: 15px;">Please click here to view the report.</p>';
                body += '  </div>';
                body += '  <div class="col-md-12" style="text-align:center; padding-top: 20px;">';
                body += '<a href="/app/common/search/searchresults.nl?searchid=804&whence=">'+ 'Cancellation Report' +'</a>';
                body += '  </div>';
                body += '  </div>';
                body += '  <br/>';
                email.sendBulk({
                    author: 5,
                    recipients: arrEmployeeList(),
                    subject: 'Overdue Product Allocation for Cancellation',
                    body: body, 
                });

            for(intIndex = 0; intIndex < arrSavedSearchReminder().length;intIndex++){
                markMailSent(arrSavedSearchReminder()[intIndex].idProductAllocation);
            }
        }

       
        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {
            sendEmail();
        }

        return {
            execute
        }

    });